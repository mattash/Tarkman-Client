/** Backend-owned public v1 projection. Never persist arbitrary response objects. */
export const MAX_BUNDLE_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024
export const LANGUAGES = ['en', 'grabar', 'translit', 'ru', 'hy_east', 'hy_west'] as const
export type BundleLanguage = typeof LANGUAGES[number]
export interface Identity { id: number; name: string; description: string | null }
export interface CatalogItem extends Identity {
  revision: string; languages_available: BundleLanguage[]; occurrence_count: number
  download_bytes: number | null; recommended_rank: number | null
}
export interface Occurrence {
  liturgy_part_id: number; liturgy_id: number; part_id: number; position: number
  role: string; posture: string | null; page: number | null; text: Record<BundleLanguage, string | null>
  requires_session_context: boolean
  explanations: { id: number; liturgy_part_id: number; title: string; description: string }[]
}
export interface Bundle { schema_version: 1; liturgy: Identity; revision: string; languages_available: BundleLanguage[]; parts: Occurrence[] }
export interface Catalog { schema_version: 1; liturgies: CatalogItem[]; next_after_id: number | null }
export type FailureCode = 'invalid' | 'size' | 'network' | 'storage' | 'unsupported' | 'cancelled' | 'unavailable' | 'capacity'
export class LibraryError extends Error { constructor(public code: FailureCode) { super(code) } }
function fail(): never { throw new LibraryError('invalid') }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
export function integer(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return fail()
  return value
}
function string(value: unknown, max = 1024 * 1024): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) return fail()
  return value
}
function nullableString(value: unknown, max?: number) { return value === null ? null : string(value, max) }
function nullableInteger(value: unknown) { return value === null ? null : integer(value) }
function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) return fail(); return value }
function languages(value: unknown): BundleLanguage[] {
  const result = array(value, 6).map(v => { if (!LANGUAGES.includes(v as BundleLanguage)) return fail(); return v as BundleLanguage })
  if (new Set(result).size !== result.length) return fail()
  return result
}
function identity(value: unknown): Identity { const v = object(value); return { id: integer(v.id), name: string(v.name, 4096), description: nullableString(v.description) } }
function revision(value: unknown) { const s = string(value, 256); if (!/^[A-Za-z0-9._:-]+$/.test(s)) return fail(); return s }
export function byteLength(text: string): number {
  // UTF-8 count without Buffer/TextEncoder dependencies in Hermes.
  let size = 0
  for (const c of text) { const n = c.codePointAt(0)!; size += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4 }
  return size
}
export function parseCatalog(value: unknown, after = 0): Catalog {
  const v = object(value); if (v.schema_version !== 1) return fail()
  let previous = after
  const liturgies = array(v.liturgies, 100).map(raw => {
    const row = object(raw), id = identity(row)
    if (id.id <= previous) return fail(); previous = id.id
    return { ...id, revision: revision(row.revision), languages_available: languages(row.languages_available),
      occurrence_count: integer(row.occurrence_count, 0, 20000), download_bytes: nullableInteger(row.download_bytes), recommended_rank: nullableInteger(row.recommended_rank) }
  })
  const next = nullableInteger(v.next_after_id)
  // Omitted invalid/oversized candidates may leave an empty page with a continuation.
  if (next !== null && (next <= after || (liturgies.length > 0 && next !== previous))) return fail()
  return { schema_version: 1, liturgies, next_after_id: next }
}
export function parseBundle(value: unknown, expectedId?: number): Bundle {
  const v = object(value); if (v.schema_version !== 1) return fail()
  const liturgy = identity(v.liturgy)
  if (expectedId !== undefined && liturgy.id !== expectedId) return fail()
  const seen = new Set<number>(), explanations = new Set<number>()
  let position = 0, lastId = 0
  const parts = array(v.parts, 20000).map(raw => {
    const p = object(raw), id = integer(p.liturgy_part_id), pos = integer(p.position)
    if (integer(p.liturgy_id) !== liturgy.id || seen.has(id) || pos < position || (pos === position && id <= lastId)) return fail()
    seen.add(id); position = pos; lastId = id
    const role = string(p.role, 32), posture = nullableString(p.posture, 32)
    if (!['priest', 'deacon', 'choir', 'people', 'instruction', 'title', 'leader', 'all', 'clergy'].includes(role) ||
      (posture !== null && !['stand', 'sit', 'kneel'].includes(posture)) || typeof p.requires_session_context !== 'boolean') return fail()
    const rawText = object(p.text), text = Object.fromEntries(LANGUAGES.map(l => [l, nullableString(rawText[l])])) as Occurrence['text']
    if (p.requires_session_context && text.en !== null) return fail()
    return { liturgy_part_id: id, liturgy_id: liturgy.id, part_id: integer(p.part_id), position: pos, role, posture,
      page: nullableInteger(p.page), text, requires_session_context: p.requires_session_context,
      explanations: array(p.explanations, 1000).map(rawExplanation => {
        const e = object(rawExplanation), eid = integer(e.id)
        if (integer(e.liturgy_part_id) !== id || explanations.has(eid)) return fail(); explanations.add(eid)
        return { id: eid, liturgy_part_id: id, title: string(e.title, 4096), description: string(e.description) }
      }) }
  })
  const available = languages(v.languages_available)
  const actual = LANGUAGES.filter(l => parts.some(p => p.text[l] !== null))
  if (JSON.stringify(available) !== JSON.stringify(actual)) return fail()
  const bundle: Bundle = { schema_version: 1, liturgy, languages_available: available, parts, revision: revision(v.revision) }
  if (byteLength(JSON.stringify(bundle)) > MAX_BUNDLE_BYTES) throw new LibraryError('size')
  return bundle
}
export function isPublicError(value: unknown, code: 'public_liturgy_unavailable' | 'bundle_too_large' | 'invalid_public_liturgy_content' | 'invalid_public_liturgy_parameters'): boolean {
  try {
    const v = object(value), e = object(v.error)
    return v.schema_version === 1 && e.code === code && Object.keys(v).length === 2 && Object.keys(e).length === 1
  } catch { return false }
}

export function isUnavailable(value: unknown): boolean { return isPublicError(value, 'public_liturgy_unavailable') }
