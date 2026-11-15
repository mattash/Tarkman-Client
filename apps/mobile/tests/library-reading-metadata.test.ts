import type { KeyValueAdapter } from '@tarkman/core'
import { createReadingMetadataStore, MAX_BOOKMARKS, parseReadingMetadata, type PassageAnchor } from '../features/library/readingMetadata'
import { resolveTextJump } from '../features/library/textFind'
import { parseBundle } from '../features/library/contracts'
import fixture from './fixtures/public_liturgies/bundle.json'
import { deferred, ticks } from './library-test-helpers'

const scope = { environment: 'https://example.test', liturgyId: 701 }
const bundle = parseBundle(fixture), part = bundle.parts[0]
const anchor: PassageAnchor = { liturgyId: 701, revision: bundle.revision, language: 'en', liturgyPartId: part.liturgy_part_id, partId: part.part_id, occurrenceIndex: 0, start: 1, end: 4 }
function metadataAdapter() {
  const data = new Map<string, string>()
  const store: KeyValueAdapter = {
    get: jest.fn(async key => data.get(key) ?? null),
    set: jest.fn(async (key, value) => { data.set(key, value) }),
    remove: jest.fn(async key => { data.delete(key) }),
  }
  return { data, store }
}

test('scopes by environment/liturgy without touching live last-reading', async () => {
  const { data, store } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  data.set('tarkman.last-reading.v1', 'live shortcut')
  await metadata.saveResume(scope, anchor)
  await metadata.saveResume({ ...scope, liturgyId: 2 }, { ...anchor, liturgyId: 2, start: 7, end: 8 })
  await metadata.saveResume({ ...scope, environment: 'other' }, { ...anchor, start: 9, end: 10 })
  expect((await metadata.read(scope)).resume).toEqual(anchor)
  expect((await metadata.read({ ...scope, liturgyId: 2 })).resume?.start).toBe(7)
  expect((await metadata.read({ ...scope, environment: 'other' })).resume?.start).toBe(9)
  await metadata.clearEnvironment(scope.environment)
  expect((await metadata.read({ ...scope, liturgyId: 2 })).resume).toBeNull()
  expect((await metadata.read({ ...scope, environment: 'other' })).resume).not.toBeNull()
  expect(data.get('tarkman.last-reading.v1')).toBe('live shortcut')
})

test('preserves exact revision and occurrence identity; projection resolves only pinned source', async () => {
  const { store } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  const anchors = [anchor, { ...anchor, occurrenceIndex: 1 }, { ...anchor, liturgyPartId: anchor.liturgyPartId + 1 }, { ...anchor, revision: 'rev-2' }, { ...anchor, language: 'ru' as const }]
  for (const saved of [...anchors, anchor]) expect(await metadata.addBookmark(scope, saved)).toBe(true)
  expect((await metadata.read(scope)).bookmarks).toEqual(anchors)
  expect(resolveTextJump(bundle, anchor)).not.toBeNull()
  for (const target of anchors.slice(1, 4)) expect(resolveTextJump(bundle, target)).toBeNull()
  await metadata.removeBookmark(scope, anchors[1])
  expect((await metadata.read(scope)).bookmarks).toEqual([anchors[0], ...anchors.slice(2)])
})

test('serializes clients, reads, and clear without lost mutations', async () => {
  const { store, data } = metadataAdapter(), first = createReadingMetadataStore(store), second = createReadingMetadataStore(store)
  const next = { ...anchor, start: 90, end: 91 }
  await Promise.all([first.saveResume(scope, anchor), second.addBookmark(scope, anchor), first.addBookmark(scope, next)])
  expect(await first.read(scope)).toEqual({ version: 1, resume: anchor, bookmarks: [anchor, next] })
  await first.clearResume(scope)
  expect((await first.read(scope)).bookmarks).toHaveLength(2)
  await Promise.all([first.saveResume(scope, anchor), second.clearEnvironment(scope.environment)])
  expect((await first.read(scope)).resume).toBeNull()
  expect(data.size).toBe(0)
})

test.each([
  null, '', '{', '{}', 'null', JSON.stringify({ sessionId: 1 }),
  JSON.stringify({ version: 2, resume: anchor, bookmarks: [] }),
  JSON.stringify({ version: 1, resume: { revision: 'old', occurrenceId: 11, offset: 42, language: 'en' }, bookmarks: [] }),
  JSON.stringify({ version: 1, resume: { ...anchor, start: -1 }, bookmarks: [] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: [{ ...anchor, liturgyPartId: 0 }] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: [{ ...anchor, end: anchor.start }] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: [{ ...anchor, language: 'unknown' }] }),
  JSON.stringify({ version: 1, resume: null, bookmarks: Array(MAX_BOOKMARKS + 1).fill(anchor) }),
  ' '.repeat(128 * 1024 + 1),
])('corrupt, provisional and future schemas fail closed (%#)', raw => {
  expect(parseReadingMetadata(raw)).toEqual({ version: 1, resume: null, bookmarks: [] })
})

test('projects allowlisted fields; snapshots caller input and rejects scope mismatch', async () => {
  const { store, data } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  const untrusted = { ...anchor, text: 'private text', sessionId: 99 }
  const saving = metadata.saveResume(scope, untrusted)
  untrusted.start = 123
  await saving
  await metadata.addBookmark(scope, { ...anchor, text: 'private text' } as PassageAnchor)
  expect([...data.values()][0]).not.toContain('private text')
  expect([...data.values()][0]).not.toContain('sessionId')
  expect((await metadata.read(scope)).resume).toEqual(anchor)
  expect(await metadata.saveResume(scope, { ...anchor, liturgyId: 2 })).toBe(false)
  expect(await metadata.saveResume(scope, { ...anchor, start: NaN })).toBe(false)
  expect(await metadata.saveResume({ ...scope, liturgyId: -1 }, anchor)).toBe(false)
})

test('queued operations snapshot mutable caller scopes as well as anchors', async () => {
  const { store } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  const writingScope = { ...scope }
  const saving = metadata.saveResume(writingScope, anchor)
  writingScope.environment = 'other'; writingScope.liturgyId = 2
  expect(await saving).toBe(true)
  const readingScope = { ...scope }, reading = metadata.read(readingScope)
  readingScope.environment = 'other'; readingScope.liturgyId = 2
  expect((await reading).resume).toEqual(anchor)
  expect((await metadata.read(writingScope)).resume).toBeNull()
})

test('bounds bookmarks without discarding records', async () => {
  const { store } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  for (let start = 0; start < MAX_BOOKMARKS; start++) expect(await metadata.addBookmark(scope, { ...anchor, start, end: start + 1 })).toBe(true)
  expect(await metadata.addBookmark(scope, { ...anchor, start: MAX_BOOKMARKS, end: MAX_BOOKMARKS + 1 })).toBe(false)
  expect((await metadata.read(scope)).bookmarks).toHaveLength(MAX_BOOKMARKS)
})

test('storage failures are explicit, nonfatal and never poison later operations', async () => {
  const { store } = metadataAdapter(), metadata = createReadingMetadataStore(store)
  jest.mocked(store.get).mockRejectedValueOnce(new Error('read failed'))
  expect(await metadata.readResult(scope)).toMatchObject({ status: 'storage', value: { resume: null } })
  jest.mocked(store.set).mockRejectedValueOnce(new Error('disk full'))
  expect(await metadata.saveResume(scope, anchor)).toBe(false)
  expect(await metadata.saveResume(scope, anchor)).toBe(true)
  jest.mocked(store.remove).mockRejectedValueOnce(new Error('delete failed'))
  expect(await metadata.clear(scope)).toBe(false)
  expect((await metadata.read(scope)).resume).toEqual(anchor)
  expect(await metadata.clear(scope)).toBe(true)
})

test('invalidated read/modify/write cannot save after asynchronous hydration', async () => {
  const { store, data } = metadataAdapter(), metadata = createReadingMetadataStore(store), loaded = deferred<string | null>()
  jest.mocked(store.get).mockReturnValueOnce(loaded.promise)
  let valid = true
  const saving = metadata.saveResume(scope, anchor, () => valid)
  await ticks(); valid = false
  const clearing = metadata.clearEnvironment(scope.environment)
  loaded.resolve(null)
  expect(await saving).toBe(false)
  expect(await clearing).toBe(true)
  expect(data.size).toBe(0)
})
