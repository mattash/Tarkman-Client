import type { KeyValueAdapter } from '@tarkman/core'
import { LANGUAGES, LibraryError, type BundleLanguage } from './contracts'
import type { TextJumpTarget } from './textFind'

const PREFIX = 'tarkman.library-reading.v1:'
export const MAX_BOOKMARKS = 100
const MAX_RECORD_LENGTH = 128 * 1024
const MAX_ENVIRONMENT_LENGTH = 2 * 1024 * 1024
const MAX_LITURGIES = 1000

/** Exact #280 address; no content, titles, session IDs or live cursor state. */
export type PassageAnchor = TextJumpTarget
export interface ReadingMetadata {
  version: 1
  resume: PassageAnchor | null
  bookmarks: PassageAnchor[]
}
export interface ReadingScope { environment: string; liturgyId: number }
export type ReadingMetadataStatus = 'ready' | 'storage' | 'stale' | 'unsupported'
export interface ReadingMetadataResult { status: ReadingMetadataStatus; value: ReadingMetadata }
export function emptyReadingMetadata(): ReadingMetadata { return { version: 1, resume: null, bookmarks: [] } }
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function positive(value: unknown): boolean { return Number.isSafeInteger(value) && (value as number) > 0 }
export function isPassageAnchor(value: unknown): value is PassageAnchor {
  return object(value) && typeof value.revision === 'string' && /^[A-Za-z0-9._:-]{1,256}$/.test(value.revision) &&
    positive(value.liturgyId) && positive(value.liturgyPartId) && positive(value.partId) &&
    Number.isSafeInteger(value.occurrenceIndex) && (value.occurrenceIndex as number) >= 0 && (value.occurrenceIndex as number) < 20000 &&
    LANGUAGES.includes(value.language as BundleLanguage) && Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end) &&
    (value.start as number) >= 0 && (value.end as number) > (value.start as number) && (value.end as number) <= 1024 * 1024
}
function project(anchor: PassageAnchor): PassageAnchor {
  const { liturgyId, revision, language, liturgyPartId, partId, occurrenceIndex, start, end } = anchor
  return { liturgyId, revision, language, liturgyPartId, partId, occurrenceIndex, start, end }
}
function same(a: PassageAnchor, b: PassageAnchor): boolean {
  return a.liturgyId === b.liturgyId && a.revision === b.revision && a.language === b.language &&
    a.liturgyPartId === b.liturgyPartId && a.partId === b.partId && a.occurrenceIndex === b.occurrenceIndex && a.start === b.start && a.end === b.end
}
function key(environment: string): string {
  if (!environment || environment.length > 2048) throw new LibraryError('invalid')
  return `${PREFIX}${encodeURIComponent(environment)}`
}
function validScope(scope: ReadingScope): void { key(scope.environment); if (!positive(scope.liturgyId)) throw new LibraryError('invalid') }

/** Provisional occurrenceId/offset records and unknown schemas fail closed, without migration. */
export function parseReadingMetadata(raw: string | null): ReadingMetadata {
  if (!raw || raw.length > MAX_RECORD_LENGTH) return emptyReadingMetadata()
  try {
    const value: unknown = JSON.parse(raw)
    if (!object(value) || value.version !== 1 || (value.resume !== null && !isPassageAnchor(value.resume)) ||
      !Array.isArray(value.bookmarks) || value.bookmarks.length > MAX_BOOKMARKS || !value.bookmarks.every(isPassageAnchor)) return emptyReadingMetadata()
    const bookmarks: PassageAnchor[] = []
    for (const anchor of value.bookmarks) if (!bookmarks.some(saved => same(saved, anchor))) bookmarks.push(project(anchor))
    return { version: 1, resume: value.resume === null ? null : project(value.resume as PassageAnchor), bookmarks }
  } catch { return emptyReadingMetadata() }
}
// One bounded environment record is also the index: clear-all includes online-only reading.
function parseEnvironment(raw: string | null): Record<string, ReadingMetadata> {
  const records: Record<string, ReadingMetadata> = {}
  if (!raw || raw.length > MAX_ENVIRONMENT_LENGTH) return records
  try {
    const value: unknown = JSON.parse(raw)
    if (!object(value) || value.version !== 1 || !object(value.liturgies) || Object.keys(value.liturgies).length > MAX_LITURGIES) return records
    for (const [id, entry] of Object.entries(value.liturgies)) {
      if (!/^[1-9]\d*$/.test(id) || !positive(Number(id))) continue
      const parsed = parseReadingMetadata(JSON.stringify(entry))
      if ((parsed.resume && parsed.resume.liturgyId !== Number(id)) || parsed.bookmarks.some(a => a.liturgyId !== Number(id))) continue
      if (parsed.resume || parsed.bookmarks.length) records[id] = parsed
    }
  } catch { /* Corrupt data is never content or a reason to fail reading. */ }
  return records
}
const queues = new WeakMap<KeyValueAdapter, Promise<unknown>>()
function serial<T>(store: KeyValueAdapter, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(store) ?? Promise.resolve()).then(operation)
  queues.set(store, next.catch(() => {}))
  return next
}

export function createReadingMetadataStore(store: KeyValueAdapter) {
  async function mutate(scope: ReadingScope, update: (value: ReadingMetadata) => ReadingMetadata | null, valid = () => true): Promise<boolean> {
    try {
      validScope(scope)
      scope = { ...scope }
      return await serial(store, async () => {
        if (!valid()) return false
        const storageKey = key(scope.environment), records = parseEnvironment(await store.get(storageKey))
        if (!valid()) return false
        const value = update(records[scope.liturgyId] ?? emptyReadingMetadata())
        if (value === null) return false
        if (!value.resume && !value.bookmarks.length) delete records[scope.liturgyId]
        else records[scope.liturgyId] = value
        if (Object.keys(records).length > MAX_LITURGIES) return false
        const raw = JSON.stringify({ version: 1, liturgies: records })
        if (raw.length > MAX_ENVIRONMENT_LENGTH) return false
        if (!Object.keys(records).length) await store.remove(storageKey)
        else await store.set(storageKey, raw)
        return valid()
      })
    } catch { return false }
  }
  const client = {
    async readResult(scope: ReadingScope, valid = () => true): Promise<ReadingMetadataResult> {
      try {
        validScope(scope)
        scope = { ...scope }
        return await serial(store, async () => {
          if (!valid()) return { status: 'stale', value: emptyReadingMetadata() }
          const records = parseEnvironment(await store.get(key(scope.environment)))
          return valid() ? { status: 'ready', value: records[scope.liturgyId] ?? emptyReadingMetadata() } : { status: 'stale', value: emptyReadingMetadata() }
        })
      } catch { return { status: 'storage', value: emptyReadingMetadata() } }
    },
    async read(scope: ReadingScope): Promise<ReadingMetadata> { return (await client.readResult(scope)).value },
    saveResume(scope: ReadingScope, anchor: PassageAnchor, valid?: () => boolean): Promise<boolean> {
      if (!isPassageAnchor(anchor) || anchor.liturgyId !== scope.liturgyId) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => ({ ...value, resume: saved }), valid)
    },
    clearResume(scope: ReadingScope, valid?: () => boolean): Promise<boolean> { return mutate(scope, value => ({ ...value, resume: null }), valid) },
    addBookmark(scope: ReadingScope, anchor: PassageAnchor, valid?: () => boolean): Promise<boolean> {
      if (!isPassageAnchor(anchor) || anchor.liturgyId !== scope.liturgyId) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => {
        if (value.bookmarks.some(existing => same(existing, saved))) return value
        if (value.bookmarks.length >= MAX_BOOKMARKS) return null
        return { ...value, bookmarks: [...value.bookmarks, saved] }
      }, valid)
    },
    removeBookmark(scope: ReadingScope, anchor: PassageAnchor, valid?: () => boolean): Promise<boolean> {
      if (!isPassageAnchor(anchor) || anchor.liturgyId !== scope.liturgyId) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => ({ ...value, bookmarks: value.bookmarks.filter(existing => !same(existing, saved)) }), valid)
    },
    clear(scope: ReadingScope): Promise<boolean> { return mutate(scope, () => emptyReadingMetadata()) },
    async clearEnvironment(environment: string): Promise<boolean> {
      try { const storageKey = key(environment); await serial(store, () => store.remove(storageKey)); return true } catch { return false }
    },
  }
  return client
}
export type ReadingMetadataStore = ReturnType<typeof createReadingMetadataStore>
