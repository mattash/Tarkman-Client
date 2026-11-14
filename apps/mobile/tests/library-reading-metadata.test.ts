import type { KeyValueAdapter } from '@tarkman/core'
import { createReadingMetadataStore, MAX_BOOKMARKS, parseReadingMetadata, type PassageAnchor } from '../features/library/readingMetadata'

const scope = { environment: 'https://example.test', liturgyId: 1 }
const anchor: PassageAnchor = { revision: 'rev-1', occurrenceId: 11, language: 'en', offset: 42 }
function adapter() {
  const data = new Map<string, string>()
  const store: KeyValueAdapter = {
    get: jest.fn(async key => data.get(key) ?? null),
    set: jest.fn(async (key, value) => { data.set(key, value) }),
    remove: jest.fn(async key => { data.delete(key) }),
  }
  return { data, store }
}

test('keeps per-liturgy and environment positions separate without touching live last-reading', async () => {
  const { data, store } = adapter(), metadata = createReadingMetadataStore(store)
  data.set('tarkman.last-reading.v1', 'live shortcut')
  await metadata.saveResume(scope, anchor)
  await metadata.saveResume({ ...scope, liturgyId: 2 }, { ...anchor, offset: 7 })
  await metadata.saveResume({ ...scope, environment: 'https://other.test' }, { ...anchor, offset: 9 })
  expect((await metadata.read(scope)).resume).toEqual(anchor)
  expect((await metadata.read({ ...scope, liturgyId: 2 })).resume?.offset).toBe(7)
  expect((await metadata.read({ ...scope, environment: 'https://other.test' })).resume?.offset).toBe(9)
  expect(data.get('tarkman.last-reading.v1')).toBe('live shortcut')
})

test('retains repeated occurrences and revision identities, deduplicating exact bookmarks only', async () => {
  const { store } = adapter(), metadata = createReadingMetadataStore(store)
  const anchors = [anchor, { ...anchor, occurrenceId: 12 }, { ...anchor, revision: 'rev-2' }, { ...anchor, language: 'ru' as const }]
  for (const saved of [...anchors, anchor]) expect(await metadata.addBookmark(scope, saved)).toBe(true)
  expect((await metadata.read(scope)).bookmarks).toEqual(anchors)
  await metadata.removeBookmark(scope, anchors[1])
  expect((await metadata.read(scope)).bookmarks).toEqual([anchors[0], anchors[2], anchors[3]])
})

test('serializes separate clients so concurrent resume and bookmark operations do not lose data', async () => {
  const { store } = adapter(), first = createReadingMetadataStore(store), second = createReadingMetadataStore(store)
  await Promise.all([first.saveResume(scope, anchor), second.addBookmark(scope, anchor), first.addBookmark(scope, { ...anchor, offset: 90 })])
  expect(await first.read(scope)).toEqual({ version: 1, resume: anchor, bookmarks: [anchor, { ...anchor, offset: 90 }] })
  await first.clearResume(scope)
  expect((await first.read(scope)).resume).toBeNull()
  expect((await first.read(scope)).bookmarks).toHaveLength(2)
})

test('clear is ordered after pending writes and never recreates content', async () => {
  const { store, data } = adapter(), metadata = createReadingMetadataStore(store)
  await Promise.all([metadata.saveResume(scope, anchor), metadata.addBookmark(scope, anchor), metadata.clear(scope)])
  expect(await metadata.read(scope)).toEqual({ version: 1, resume: null, bookmarks: [] })
  expect(data.size).toBe(0)
})

test.each([
  null, '', '{', '{}', 'null', JSON.stringify({ sessionId: 1, title: 'Live session' }),
  JSON.stringify({ version: 2, resume: anchor, bookmarks: [] }),
  JSON.stringify({ version: 1, resume: { ...anchor, offset: -1 }, bookmarks: [] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: [{ ...anchor, occurrenceId: 0 }] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: [{ ...anchor, language: 'unknown' }] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: Array(MAX_BOOKMARKS + 1).fill(anchor) }),
  ' '.repeat(128 * 1024 + 1),
])('corrupt, legacy and future schemas fail closed (%#)', raw => {
  expect(parseReadingMetadata(raw)).toEqual({ version: 1, resume: null, bookmarks: [] })
})

test('projects allowlisted fields and never saves occurrence text or arbitrary metadata', async () => {
  const { store, data } = adapter(), metadata = createReadingMetadataStore(store)
  const untrusted = { ...anchor, text: 'private text', sessionId: 99 }
  await metadata.saveResume(scope, untrusted)
  await metadata.addBookmark(scope, untrusted)
  expect([...data.values()][0]).not.toContain('private text')
  expect([...data.values()][0]).not.toContain('sessionId')
  expect(parseReadingMetadata(JSON.stringify({ version: 1, resume: untrusted, bookmarks: [untrusted, untrusted] })))
    .toEqual({ version: 1, resume: anchor, bookmarks: [anchor] })
})

test('bounds bookmarks without discarding existing records', async () => {
  const { store } = adapter(), metadata = createReadingMetadataStore(store)
  for (let offset = 0; offset < MAX_BOOKMARKS; offset++) expect(await metadata.addBookmark(scope, { ...anchor, offset })).toBe(true)
  expect(await metadata.addBookmark(scope, { ...anchor, offset: MAX_BOOKMARKS })).toBe(false)
  expect((await metadata.read(scope)).bookmarks).toHaveLength(MAX_BOOKMARKS)
  expect(await metadata.addBookmark(scope, anchor)).toBe(true)
})

test('storage failures remain nonfatal and do not poison later operations', async () => {
  const { store } = adapter(), metadata = createReadingMetadataStore(store)
  jest.mocked(store.get).mockRejectedValueOnce(new Error('read failed'))
  expect((await metadata.read(scope)).resume).toBeNull()
  jest.mocked(store.set).mockRejectedValueOnce(new Error('disk full'))
  expect(await metadata.saveResume(scope, anchor)).toBe(false)
  expect(await metadata.saveResume(scope, anchor)).toBe(true)
  jest.mocked(store.remove).mockRejectedValueOnce(new Error('delete failed'))
  expect(await metadata.clear(scope)).toBe(false)
  expect((await metadata.read(scope)).resume).toEqual(anchor)
  expect(await metadata.clear(scope)).toBe(true)
})

test('rejects invalid inputs without storage access and snapshots caller data before queuing', async () => {
  const { store } = adapter(), metadata = createReadingMetadataStore(store)
  expect(await metadata.saveResume(scope, { ...anchor, offset: NaN })).toBe(false)
  expect(store.get).not.toHaveBeenCalled()
  expect(await metadata.saveResume({ ...scope, liturgyId: -1 }, anchor)).toBe(false)
  const input = { ...anchor }, saving = metadata.saveResume(scope, input)
  input.offset = 123
  await saving
  expect((await metadata.read(scope)).resume).toEqual(anchor)
})
