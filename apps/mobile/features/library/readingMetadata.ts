import type { KeyValueAdapter } from '@tarkman/core'
import { LANGUAGES, type BundleLanguage } from './contracts'

const PREFIX = 'tarkman.library-reading.v1:'
export const MAX_BOOKMARKS = 100
const MAX_RECORD_LENGTH = 128 * 1024

/** No content, titles, session IDs or live cursor state belongs in this record. */
export interface PassageAnchor {
  revision: string
  occurrenceId: number
  language: BundleLanguage
  /** UTF-16 offset in the original occurrence text, not a pixel offset or normalized search text. */
  offset: number
}
export interface ReadingMetadata {
  version: 1
  resume: PassageAnchor | null
  bookmarks: PassageAnchor[]
}
export interface ReadingScope { environment: string; liturgyId: number }

function empty(): ReadingMetadata { return { version: 1, resume: null, bookmarks: [] } }
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function isAnchor(value: unknown): value is PassageAnchor {
  return object(value) && typeof value.revision === 'string' && /^[A-Za-z0-9._:-]{1,256}$/.test(value.revision) &&
    Number.isSafeInteger(value.occurrenceId) && (value.occurrenceId as number) > 0 &&
    LANGUAGES.includes(value.language as BundleLanguage) && Number.isSafeInteger(value.offset) && (value.offset as number) >= 0 && (value.offset as number) <= 1024 * 1024
}
function project(anchor: PassageAnchor): PassageAnchor {
  return { revision: anchor.revision, occurrenceId: anchor.occurrenceId, language: anchor.language, offset: anchor.offset }
}
function same(a: PassageAnchor, b: PassageAnchor): boolean {
  return a.revision === b.revision && a.occurrenceId === b.occurrenceId && a.language === b.language && a.offset === b.offset
}
function key(scope: ReadingScope): string {
  if (!scope.environment || scope.environment.length > 2048 || !Number.isSafeInteger(scope.liturgyId) || scope.liturgyId <= 0) throw new Error('Invalid reading scope')
  // The caller supplies the controller's normalized environment, never a URL from a link.
  return `${PREFIX}${encodeURIComponent(scope.environment)}:${scope.liturgyId}`
}

/** Unknown schemas and corrupt records fail closed; never migrate the unrelated live-session shortcut. */
export function parseReadingMetadata(raw: string | null): ReadingMetadata {
  if (!raw || raw.length > MAX_RECORD_LENGTH) return empty()
  try {
    const value: unknown = JSON.parse(raw)
    if (!object(value) || value.version !== 1 || (value.resume !== null && !isAnchor(value.resume)) ||
      !Array.isArray(value.bookmarks) || value.bookmarks.length > MAX_BOOKMARKS || !value.bookmarks.every(isAnchor)) return empty()
    const bookmarks: PassageAnchor[] = []
    for (const anchor of value.bookmarks) if (!bookmarks.some(saved => same(saved, anchor))) bookmarks.push(project(anchor))
    return { version: 1, resume: value.resume === null ? null : project(value.resume as PassageAnchor), bookmarks }
  } catch { return empty() }
}

// Share a queue across clients using the same adapter: a resume write must not lose a bookmark,
// and clear/remove must finish after already-enqueued writes. Failures must not poison the queue.
const queues = new WeakMap<KeyValueAdapter, Promise<unknown>>()
function serial<T>(store: KeyValueAdapter, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(store) ?? Promise.resolve()).then(operation)
  queues.set(store, next.catch(() => {}))
  return next
}

/** Storage only. Opening content and resolving the anchor remain the reader's responsibility. */
export function createReadingMetadataStore(store: KeyValueAdapter) {
  async function mutate(scope: ReadingScope, update: (value: ReadingMetadata) => ReadingMetadata | null): Promise<boolean> {
    try {
      const storageKey = key(scope)
      return await serial(store, async () => {
        const value = update(parseReadingMetadata(await store.get(storageKey)))
        if (value === null) return false
        if (!value.resume && !value.bookmarks.length) await store.remove(storageKey)
        else await store.set(storageKey, JSON.stringify(value))
        return true
      })
    } catch { return false }
  }
  return {
    async read(scope: ReadingScope): Promise<ReadingMetadata> {
      try { const storageKey = key(scope); return await serial(store, async () => parseReadingMetadata(await store.get(storageKey))) }
      catch { return empty() }
    },
    saveResume(scope: ReadingScope, anchor: PassageAnchor): Promise<boolean> {
      if (!isAnchor(anchor)) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => ({ ...value, resume: saved }))
    },
    clearResume(scope: ReadingScope): Promise<boolean> {
      return mutate(scope, value => ({ ...value, resume: null }))
    },
    addBookmark(scope: ReadingScope, anchor: PassageAnchor): Promise<boolean> {
      if (!isAnchor(anchor)) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => {
        if (value.bookmarks.some(existing => same(existing, saved))) return value
        if (value.bookmarks.length >= MAX_BOOKMARKS) return null
        return { ...value, bookmarks: [...value.bookmarks, saved] }
      })
    },
    removeBookmark(scope: ReadingScope, anchor: PassageAnchor): Promise<boolean> {
      if (!isAnchor(anchor)) return Promise.resolve(false)
      const saved = project(anchor)
      return mutate(scope, value => ({ ...value, bookmarks: value.bookmarks.filter(existing => !same(existing, saved)) }))
    },
    /** Also usable for confirmed removal/revocation; does not request or recreate a download. */
    async clear(scope: ReadingScope): Promise<boolean> {
      try { const storageKey = key(scope); await serial(store, () => store.remove(storageKey)); return true }
      catch { return false }
    },
  }
}
