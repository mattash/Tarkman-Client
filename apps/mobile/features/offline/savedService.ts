import type { LiveExplanation, LivePart, LiveSession } from '../live/contracts'

export const SAVED_SERVICE_KEY = 'tarkman.saved-service.v1'
export const SAVED_SERVICE_TTL_MS = 7 * 86_400_000
/** Decimal MB, measured as UTF-8 bytes, including JSON escaping and metadata. */
export const SAVED_SERVICE_MAX_BYTES = 1_500_000

export interface SavedServiceInput {
  session: Pick<LiveSession, 'id' | 'title' | 'church' | 'date'>
  parts: LivePart[]
  /** On save, omission preserves the valid prior block for this session; null explicitly clears it. */
  explanations?: { liturgyPartId: number | null; items: LiveExplanation[] } | null
}
export interface SavedServiceV1 extends SavedServiceInput {
  version: 1
  savedAt: number
  explanations: NonNullable<SavedServiceInput['explanations']> | null
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
function nullableId(value: unknown): value is number | null { return value === null || id(value) }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === 'string' }

/** Re-project every level: extra fields from disk or widened network types never become saved state. */
export function validateSavedService(value: unknown, now: number): SavedServiceV1 | null {
  if (!object(value) || value.version !== 1 || typeof value.savedAt !== 'number'
    || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0 || !Number.isFinite(now)
    || value.savedAt > now || now - value.savedAt >= SAVED_SERVICE_TTL_MS) return null
  const s = value.session
  if (!object(s) || !id(s.id) || typeof s.title !== 'string' || typeof s.church !== 'string' || !nullableText(s.date)) return null
  if (!Array.isArray(value.parts) || value.parts.length === 0) return null
  const parts: LivePart[] = [], keys = new Set<string>()
  for (const p of value.parts) {
    if (!object(p) || !id(p.id) || typeof p.key !== 'string' || !p.key || keys.has(p.key)
      || !nullableId(p.liturgyId) || !nullableId(p.liturgyPartId) || !id(p.position)
      || typeof p.role !== 'string' || !nullableText(p.posture) || !object(p.text)) return null
    const { en, ru, grabar, translit } = p.text
    if (!nullableText(en) || !nullableText(ru) || !nullableText(grabar) || !nullableText(translit)) return null
    keys.add(p.key)
    parts.push({ id: p.id, key: p.key, liturgyId: p.liturgyId, liturgyPartId: p.liturgyPartId,
      ...(p.page === undefined ? {} : { page: id(p.page) ? p.page : null }),
      ...(p.effectiveDurationMs === undefined ? {} : { effectiveDurationMs: id(p.effectiveDurationMs) ? p.effectiveDurationMs : null }),
      ...(p.hyEast === undefined ? {} : { hyEast: nullableText(p.hyEast) ? p.hyEast : null }),
      ...(p.hyWest === undefined ? {} : { hyWest: nullableText(p.hyWest) ? p.hyWest : null }),
      position: p.position, role: p.role, posture: p.posture, text: { en, ru, grabar, translit } })
  }
  let explanations: SavedServiceV1['explanations'] = null
  if (value.explanations !== null) {
    const block = value.explanations
    if (!object(block) || !nullableId(block.liturgyPartId) || !Array.isArray(block.items)) return null
    const items: LiveExplanation[] = []
    for (const e of block.items) {
      if (!object(e) || !id(e.id) || typeof e.title !== 'string' || !nullableText(e.description) || !nullableId(e.liturgyPartId)) return null
      items.push({ id: e.id, title: e.title, description: e.description, liturgyPartId: e.liturgyPartId })
    }
    explanations = { liturgyPartId: block.liturgyPartId, items }
  }
  return { version: 1, savedAt: value.savedAt, session: { id: s.id, title: s.title, church: s.church, date: s.date }, parts, explanations }
}

export function buildSavedService(input: SavedServiceInput, now: number): SavedServiceV1 | null {
  return validateSavedService({ version: 1, savedAt: now, session: input.session, parts: input.parts,
    explanations: input.explanations ?? null }, now)
}

/** Counts Unicode code points without relying on a browser or Node-only encoder. */
export function serializedBytes(json: string): number {
  let bytes = 0
  for (const character of json) {
    const code = character.codePointAt(0)!
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
  }
  return bytes
}

export function readSavedService(raw: string | null, now: number): SavedServiceV1 | null {
  if (!raw || serializedBytes(raw) > SAVED_SERVICE_MAX_BYTES) return null
  try { return validateSavedService(JSON.parse(raw), now) } catch { return null }
}

export type SavedServiceSerialization = { json: string; dropped?: 'explanations' } | { tooLarge: true } | { invalid: true }

export function serializeSavedService(record: SavedServiceV1): SavedServiceSerialization {
  const clean = validateSavedService(record, record.savedAt)
  if (!clean) return { invalid: true }
  const json = JSON.stringify(clean)
  if (serializedBytes(json) <= SAVED_SERVICE_MAX_BYTES) return { json }
  const withoutExplanations = JSON.stringify({ ...clean, explanations: null })
  if (serializedBytes(withoutExplanations) <= SAVED_SERVICE_MAX_BYTES) return { dropped: 'explanations', json: withoutExplanations }
  return { tooLarge: true }
}
