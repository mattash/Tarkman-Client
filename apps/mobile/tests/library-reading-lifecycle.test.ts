import type { KeyValueAdapter } from '@tarkman/core'
import fixture from './fixtures/public_liturgies/bundle.json'
import { createLibrary } from '../features/library/downloadCoordinator'
import { createReadingMetadataStore, type PassageAnchor } from '../features/library/readingMetadata'
import { LibraryError, parseBundle, type Bundle } from '../features/library/contracts'
import { deferred, memoryStore, ticks } from './library-test-helpers'

const bundle = parseBundle(fixture), id = bundle.liturgy.id, part = bundle.parts[0]
const anchor: PassageAnchor = { liturgyId: id, revision: bundle.revision, language: 'en', liturgyPartId: part.liturgy_part_id, partId: part.part_id, occurrenceIndex: 0, start: 0, end: 1 }
function setup() {
  const data = new Map<string, string>()
  const adapter: KeyValueAdapter = {
    get: jest.fn(async key => data.get(key) ?? null),
    set: jest.fn(async (key, value) => { data.set(key, value) }),
    remove: jest.fn(async key => { data.delete(key) }),
  }
  const metadata = createReadingMetadataStore(adapter), store = memoryStore()
  const api = { catalog: jest.fn(), bundle: jest.fn<Promise<Bundle | null>, [number, AbortSignal, string?]>(async () => bundle) }
  const library = createLibrary('test', api, store, () => 1000, metadata)
  return { library, metadata, adapter, data, api, store }
}

test('normal removal invalidates an open online lease synchronously; only explicit later open can work', async () => {
  const { library, api } = setup(), lease = library.readingEpoch(id)
  expect(await library.request(id, false)).toEqual(bundle)
  expect(await library.reading.saveResume(id, anchor, lease)).toBe('ready')
  const remove = library.remove(id)
  expect(library.isContentCurrent(id, lease)).toBe(false)
  expect(await library.reading.saveResume(id, anchor, lease)).toBe('stale')
  await remove
  expect((await library.reading.read(id)).value.resume).toBeNull()
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect(await library.request(id, false)).toEqual(bundle)
  expect(library.isContentCurrent(id, lease)).toBe(false)
  expect(await library.reading.saveResume(id, anchor, library.readingEpoch(id))).toBe('ready')
})

test('clear-all removes previously online-only metadata across controller recreation and invalidates unknown ids', async () => {
  const { library, metadata, store, api } = setup()
  await library.reading.addBookmark(id, anchor, library.readingEpoch(id))
  const other = createLibrary('other', api, store, Date.now, metadata)
  await other.reading.saveResume(id, anchor, other.readingEpoch(id))
  const next = createLibrary('test', api, store, Date.now, metadata), lease = next.readingEpoch(id)
  expect(next.getSnapshot().items).toEqual([])
  await next.remove()
  expect(next.isContentCurrent(id, lease)).toBe(false)
  expect((await next.reading.read(id)).value.bookmarks).toEqual([])
  expect((await other.reading.read(id)).value.resume).toEqual(anchor)
  expect(api.bundle).not.toHaveBeenCalled()
})

test.each(['remove', 'revoke', 'all'] as const)('%s beats a pending metadata set and stale follow-up saves', async action => {
  const { library, adapter, data, api } = setup(), entered = deferred<void>(), release = deferred<void>()
  const originalSet = adapter.set
  jest.mocked(adapter.set).mockImplementationOnce(async (key, value) => { entered.resolve(); await release.promise; await originalSet(key, value) })
  const lease = library.readingEpoch(id), saving = library.reading.saveResume(id, anchor, lease)
  await entered.promise
  let removing: Promise<unknown>
  if (action === 'revoke') { api.bundle.mockRejectedValueOnce(new LibraryError('unavailable')); removing = library.request(id, false); await ticks() }
  else removing = library.remove(action === 'all' ? undefined : id)
  expect(library.isContentCurrent(id, lease)).toBe(false)
  expect(await library.reading.addBookmark(id, anchor, lease)).toBe('stale')
  release.resolve()
  expect(await saving).toBe('stale')
  await removing
  expect(data.size).toBe(0)
  expect((await library.reading.read(id)).value.resume).toBeNull()
})

test('pending metadata read cannot hydrate an invalidated reader', async () => {
  const { library, adapter } = setup(), loaded = deferred<string | null>()
  await library.reading.saveResume(id, anchor, library.readingEpoch(id))
  const original = await adapter.get('tarkman.library-reading.v1:test')
  jest.mocked(adapter.get).mockReturnValueOnce(loaded.promise)
  const reading = library.reading.read(id, library.readingEpoch(id))
  await ticks()
  const removing = library.remove(id)
  loaded.resolve(original)
  expect(await reading).toMatchObject({ status: 'stale', value: { resume: null, bookmarks: [] } })
  await removing
})

test.each(['remove', 'all', 'revoke'] as const)('%s cancels content readers/downloads and metadata without late recreation', async action => {
  const { library, api, store } = setup(), late = deferred<Bundle>()
  await library.reading.saveResume(id, anchor, library.readingEpoch(id))
  api.bundle.mockReturnValueOnce(late.promise)
  const download = library.request(id, true)
  await ticks()
  if (action === 'revoke') {
    // A second id can revoke independently; this id's coalesced operation supplies unavailable.
    late.resolve(bundle)
    await download
    api.bundle.mockRejectedValueOnce(new LibraryError('unavailable'))
    await library.request(id, true)
  } else {
    await library.remove(action === 'all' ? undefined : id)
    late.resolve(bundle)
    expect(await download).toBeUndefined()
  }
  expect(store.rows.size).toBe(0)
  expect(library.getSnapshot().items).toEqual([])
  expect((await library.reading.read(id)).value.resume).toBeNull()
})

test.each([false, true])('removal in the final publication turn discards late %s request completion', async save => {
  const { library, store } = setup()
  let removing: Promise<void> | undefined, sawBusy = false
  const unsubscribe = library.subscribe(() => {
    if (library.getSnapshot().status[id]) sawBusy = true
    if (sawBusy && !library.getSnapshot().status[id] && !removing) {
      // Set a sentinel first because remove itself publishes synchronously.
      removing = Promise.resolve()
      removing = library.remove(id)
    }
  })
  expect(await library.request(id, save)).toBeUndefined()
  await removing
  unsubscribe()
  expect(store.rows.size).toBe(0)
})

test('metadata delete failure is nonfatal to content deletion, visible and retryable', async () => {
  const { library, adapter } = setup(), lease = library.readingEpoch(id)
  await library.request(id, true)
  await library.reading.saveResume(id, anchor, lease)
  jest.mocked(adapter.remove).mockRejectedValueOnce(new Error('disk'))
  await expect(library.remove(id)).rejects.toMatchObject({ code: 'storage' })
  expect(library.getSnapshot()).toMatchObject({ items: [], storageError: 'storage' })
  expect(await library.reading.saveResume(id, anchor, lease)).toBe('stale')
  await library.remove(id)
  expect(library.getSnapshot().storageError).toBeUndefined()
  expect((await library.reading.read(id)).value.resume).toBeNull()
})

test('removal during content hydration blocks old requests before network', async () => {
  const { library, store, api } = setup(), loaded = deferred<Awaited<ReturnType<typeof store.hydrate>>>()
  store.hydrate = () => loaded.promise
  const request = library.request(id, true)
  const rejected = expect(request).rejects.toMatchObject({ code: 'cancelled' })
  const removing = library.remove()
  loaded.resolve({ items: [], dismissed: false, corrupt: 0 })
  await rejected; await removing
  expect(api.bundle).not.toHaveBeenCalled()
})
