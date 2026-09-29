/** JSON additions remain visible; schema migrations must not project away upstream fields. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export interface Metadata { [key: string]: JsonValue | undefined }
export type Language = 'en' | 'hy'
export interface ReadingReference extends Metadata {
  book: string
  start_chapter: number
  start_verse: number
  end_chapter: number
  end_verse: number
  /** Upstream's canonical English citation, including shared composite back-pointers. */
  citation: string
}
export interface Observance extends Metadata {
  id: string
  name: string
  /** Independent observance marks; neither is a date-level fasting decision. */
  is_fast: boolean
  is_comm: boolean
}
export interface LectionaryDay {
  [key: string]: unknown
  Date: string
  Language: Language
  'Liturgical Day': string
  Season: string
  Mode: { Tone: string; Number: number; [key: string]: JsonValue }
  Readings: Record<string, string[]>
  ReadingsList: string[]
  ReadingsRefs: ReadingReference[]
  Observances: Observance[]
  ObservanceIds: string[]
  Source: string
  Confidence?: string | null
  Note?: string | null
}
export interface PackMetadata {
  year: number
  language: Language
  file: string
  days: number
  bytes: number
  sha256: string
}
export interface DatasetManifest {
  schemaVersion: 1
  datasetId: string
  exporterVersion: string
  upstream: { repository: string; commit: string; version: string; archiveSha256: string }
  languages: Language[]
  coverage: { from: string; through: string }
  resultCount: number
  packs: PackMetadata[]
}
export type DayResult =
  | { ok: true; day: LectionaryDay; dataset: DatasetManifest }
  | { ok: false; reason: 'invalid-date' | 'unsupported-language' | 'out-of-range' }
  | { ok: false; reason: 'data-load'; detail: 'missing-pack' | 'corrupt-pack' | 'load-failed' }
export interface Lectionary {
  getDay(date: string, options?: { language?: string }): Promise<DayResult>
  getMetadata(): DatasetManifest
}
export interface YearPack {
  schemaVersion: 1
  datasetId: string
  year: number
  language: Language
  days: Record<string, LectionaryDay>
}

/** Date-only arithmetic: never passes through a device zone, UTC timestamp or guessed today. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return year > 0 && month >= 1 && month <= 12 && day > 0 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function positive(value: unknown): value is number { return Number.isInteger(value) && (value as number) > 0 }
function json(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(json)
  return object(value) && Object.values(value).every(json)
}
function validDay(day: unknown, date: string, language: Language): day is LectionaryDay {
  if (!object(day) || !json(day) || day.Date !== date || day.Language !== language) return false
  if (!['Liturgical Day', 'Season', 'Source'].every(key => typeof day[key] === 'string')) return false
  if (!object(day.Mode) || typeof day.Mode.Tone !== 'string' || !positive(day.Mode.Number) || day.Mode.Number > 8) return false
  if (!object(day.Readings) || !Object.values(day.Readings).every(strings) || !strings(day.ReadingsList)) return false
  if (!Array.isArray(day.ReadingsRefs) || !day.ReadingsRefs.every(ref => object(ref) && typeof ref.book === 'string' && typeof ref.citation === 'string' &&
    ['start_chapter', 'end_chapter', 'start_verse', 'end_verse'].every(key => positive(ref[key])))) return false
  if (!strings(day.ObservanceIds) || !Array.isArray(day.Observances) || !day.Observances.every(observance => object(observance) &&
    typeof observance.id === 'string' && typeof observance.name === 'string' && typeof observance.is_fast === 'boolean' && typeof observance.is_comm === 'boolean')) return false
  if (day.Observances.length !== day.ObservanceIds.length || day.Observances.some((item, index) => item.id !== (day.ObservanceIds as string[])[index])) return false
  return ['Confidence', 'Note'].every(key => !(key in day) || day[key] === null || typeof day[key] === 'string')
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
class PackError extends Error {
  constructor(readonly detail: 'missing-pack' | 'corrupt-pack' | 'load-failed') { super(detail) }
}
function validatePack(value: unknown, manifest: DatasetManifest, year: number, language: Language): YearPack {
  if (value == null) throw new PackError('missing-pack')
  if (!object(value) || value.schemaVersion !== 1 || value.datasetId !== manifest.datasetId || value.year !== year || value.language !== language || !object(value.days)) throw new PackError('corrupt-pack')
  const meta = manifest.packs.find(pack => pack.year === year && pack.language === language)
  const entries = Object.entries(value.days)
  // Coverage is defined by the manifest, including partial years in future datasets.
  let expected = 0
  for (let month = 1; month <= 12; month++) for (let day = 1; day <= 31; day++) {
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (isCalendarDate(date) && date >= manifest.coverage.from && date <= manifest.coverage.through) expected++
  }
  if (!meta || entries.length !== expected || entries.length !== meta.days || !entries.every(([date, day]) =>
    isCalendarDate(date) && Number(date.slice(0, 4)) === year && date >= manifest.coverage.from && date <= manifest.coverage.through && validDay(day, date, language))) throw new PackError('corrupt-pack')
  // The loader can retain/mutate its objects. The cache owns a detached copy.
  return clone(value) as unknown as YearPack
}

/** Storage is injected. Consumers never depend on filenames, compression or indexing. */
export function createLectionary({ manifest, loadYear }: {
  manifest: DatasetManifest
  loadYear(year: number, language: Language): unknown | Promise<unknown>
}): Lectionary {
  if (manifest.schemaVersion !== 1 || !isCalendarDate(manifest.coverage.from) || !isCalendarDate(manifest.coverage.through) || manifest.coverage.from > manifest.coverage.through) throw new Error('Unsupported lectionary manifest')
  const identity = clone(manifest)
  const cache = new Map<string, Promise<YearPack>>()
  return {
    getMetadata: () => clone(identity),
    async getDay(date, options = {}) {
      if (!isCalendarDate(date)) return { ok: false, reason: 'invalid-date' }
      if (!object(options)) return { ok: false, reason: 'unsupported-language' }
      const language = options.language === undefined ? 'en' : options.language
      if ((language !== 'en' && language !== 'hy') || !identity.languages.includes(language)) return { ok: false, reason: 'unsupported-language' }
      if (date < identity.coverage.from || date > identity.coverage.through) return { ok: false, reason: 'out-of-range' }
      const year = Number(date.slice(0, 4)), key = `${year}/${language}`
      if (!identity.packs.some(pack => pack.year === year && pack.language === language)) return { ok: false, reason: 'data-load', detail: 'missing-pack' }
      try {
        let pending = cache.get(key)
        if (!pending) {
          pending = Promise.resolve().then(() => loadYear(year, language)).then(value => validatePack(value, identity, year, language))
          cache.set(key, pending)
          // Failures are retryable; concurrent requests still share the same load.
          void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key) })
        }
        const pack = await pending
        if (!pack.days[date]) throw new PackError('corrupt-pack')
        return { ok: true, day: clone(pack.days[date]), dataset: clone(identity) }
      } catch (error) {
        return { ok: false, reason: 'data-load', detail: error instanceof PackError ? error.detail : 'load-failed' }
      }
    },
  }
}
