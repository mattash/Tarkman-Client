import { it, expect, jest } from '@jest/globals'
import fixture from './fixtures/public_liturgies/bundle.json'
import changed from './fixtures/public_liturgies/bundle_updated.json'
import catalog from './fixtures/public_liturgies/catalog.json'
import { createLibrary } from '../features/library/downloadCoordinator'
import { LibraryError, parseBundle, parseCatalog, type Bundle } from '../features/library/contracts'
import { memoryStore, deferred, ticks } from './library-test-helpers'
const bundle = parseBundle(fixture), updated = parseBundle(changed)
function setup() {
  const store = memoryStore(), api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn<(id: number, signal: AbortSignal, revision?: string) => Promise<Bundle | null>>(async () => bundle) }
  return { store, api, library: createLibrary('test', api, store, () => 1000) }
}
it('entry, recommendation metadata and Skip never transfer content; dismissal survives controller recreation', async () => {
  const { library, api, store } = setup()
  await library.refresh(); await library.refresh(); await library.dismiss()
  expect(api.bundle).not.toHaveBeenCalled(); expect(api.catalog).toHaveBeenCalledTimes(2)
  const next = createLibrary('test', api, store); await next.hydrate(); expect(next.getSnapshot().dismissed).toBe(true)
})
it('only explicit selection persists, sync only selected IDs, and removed recommendations stay removed', async () => {
  const { library, api } = setup()
  await library.refresh(); await library.request(701, true)
  expect(library.getSnapshot().items[0].bundle).toEqual(bundle)
  await library.remove(701); await library.sync()
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect(library.getSnapshot().items).toEqual([])
})
it('online reads never create saved intent or durable downloads', async () => {
  const { library, store } = setup()
  expect(await library.request(701, false)).toEqual(bundle)
  expect(store.rows.size).toBe(0)
})
it('keeps old complete copy and timestamp after invalid content or disk-full update', async () => {
  const { library, api, store } = setup()
  await library.request(701, true); api.bundle.mockResolvedValue(updated); store.fail = true
  await library.request(701, true)
  expect(library.getSnapshot().items[0].bundle).toEqual(bundle)
  expect(library.getSnapshot().failures[701]).toBe('storage')
  expect(library.getSnapshot().items[0].savedAt).toBe(1000)
})
it('honors 304 only with intact local copy, then retries once unconditionally', async () => {
  const { library, api, store } = setup()
  await library.request(701, true)
  api.bundle.mockResolvedValueOnce(null)
  await library.request(701, true)
  expect(library.getSnapshot().items[0].savedAt).toBe(1000)
  store.rows.clear(); api.bundle.mockResolvedValueOnce(null).mockResolvedValueOnce(updated)
  await library.request(701, true)
  expect(api.bundle.mock.calls.at(-1)?.[2]).toBeUndefined()
  expect(library.getSnapshot().items[0].bundle).toEqual(updated)
})
it('revalidates a catalog race once and rejects a second changing revision', async () => {
  const { library, api } = setup(); await library.refresh()
  api.bundle.mockResolvedValueOnce(updated).mockResolvedValueOnce(bundle)
  await library.request(701, true)
  expect(api.bundle).toHaveBeenCalledTimes(2); expect(library.getSnapshot().items[0].bundle).toBeNull()
  expect(library.getSnapshot().failures[701]).toBe('invalid')
})
it.each(['network', 'invalid', 'size'] as const)('generic %s errors retain copies, typed unavailable removes only its item', async code => {
  const { library, api } = setup(); await library.request(701, true)
  api.bundle.mockRejectedValueOnce(new LibraryError(code)); await library.request(701, true)
  expect(library.getSnapshot().items[0].bundle).toEqual(bundle)
  api.bundle.mockRejectedValueOnce(new LibraryError('unavailable')); await library.request(701, true)
  expect(library.getSnapshot().items).toEqual([]); expect(library.getSnapshot().revoked).toEqual([701])
})
it('limits concurrency to two, coalesces duplicate taps, removal beats ignored cancellation and late responses', async () => {
  const { library, api } = setup(), first = deferred<Bundle>(), second = deferred<Bundle>()
  api.bundle.mockImplementation(id => id === 701 ? first.promise : second.promise)
  const p1 = library.request(701, true), p2 = library.request(702, true), p3 = library.request(703, true)
  await ticks(); void library.request(701, true)
  expect(api.bundle).toHaveBeenCalledTimes(2)
  await library.remove(); first.resolve(bundle); second.resolve(bundle)
  await Promise.all([p1, p2, p3])
  expect(library.getSnapshot().items).toEqual([])
  expect(api.bundle).toHaveBeenCalledTimes(2)
})
it('background cancellation and disposal prevent late commits; environments stay separate', async () => {
  const { library, api, store } = setup(), response = deferred<Bundle>()
  api.bundle.mockReturnValue(response.promise)
  const pending = library.request(701, true); await ticks(); library.cancel(); response.resolve(bundle); await pending
  expect(library.getSnapshot().items[0].bundle).toBeNull()
  const other = createLibrary('other', api, store); await other.hydrate(); expect(other.getSnapshot().items).toEqual([])
  const late = deferred<Bundle>(); api.bundle.mockReturnValue(late.promise)
  const next = library.request(701, true); await ticks(); library.dispose(); late.resolve(bundle); await next
  expect((await store.hydrate('test')).items[0].bundle).toBeNull()
})
it('multiple selections survive independently and revocation of one never removes another environment or ID', async () => {
  const { library, api, store } = setup()
  const second = parseBundle({ ...fixture, liturgy: { ...fixture.liturgy, id: 702 }, parts: fixture.parts.map(p => ({ ...p, liturgy_id: 702 })) })
  api.bundle.mockImplementation(async id => id === 701 ? bundle : second)
  await library.request(701, true); await library.request(702, true)
  const other = createLibrary('other', api, store); await other.request(701, true)
  api.bundle.mockRejectedValueOnce(new LibraryError('unavailable')); await library.request(701, true)
  expect(library.getSnapshot().items.map(i => i.id)).toEqual([702])
  expect((await store.hydrate('other')).items[0].bundle).toEqual(bundle)
})

it('cancellation during storage hydration prevents subsequently starting queued HTTP work', async () => {
  const { store, api } = setup(), loaded = deferred<Awaited<ReturnType<typeof store.hydrate>>>()
  store.hydrate = () => loaded.promise
  const library = createLibrary('test', api, store)
  const requested = library.request(701, true), refreshed = library.refresh()
  const rejected = expect(requested).rejects.toMatchObject({ code: 'cancelled' })
  library.cancel(); loaded.resolve({ items: [], dismissed: false, corrupt: 0 })
  await rejected; await refreshed
  expect(api.bundle).not.toHaveBeenCalled(); expect(api.catalog).not.toHaveBeenCalled()
})

it('queues Download behind an in-flight Read online and coalesces durable waiters until commit', async () => {
  const { library, api, store } = setup(), online = deferred<Bundle>(), saved = deferred<Bundle>()
  api.bundle.mockReturnValueOnce(online.promise).mockReturnValueOnce(saved.promise)
  const read = library.request(701, false); await ticks()
  const download = library.request(701, true), duplicate = library.request(701, true)
  let finished = false; void download.then(() => { finished = true })
  await ticks(); expect(api.bundle).toHaveBeenCalledTimes(1); expect(store.rows.size).toBe(0)
  online.resolve(bundle); expect(await read).toEqual(bundle); await ticks()
  expect(api.bundle).toHaveBeenCalledTimes(2); expect(finished).toBe(false)
  saved.resolve(bundle); await Promise.all([download, duplicate])
  expect((await store.hydrate('test')).items[0].bundle).toEqual(bundle)
  expect(finished).toBe(true)
})
it.each(['cancel', 'remove', 'clear', 'dispose'] as const)('%s discards durable follow-up queued behind Read online', async action => {
  const { library, api, store } = setup(), online = deferred<Bundle>()
  api.bundle.mockReturnValueOnce(online.promise)
  const read = library.request(701, false); await ticks()
  const download = library.request(701, true); await ticks()
  if (action === 'remove') await library.remove(701)
  else if (action === 'clear') await library.remove()
  else library[action]()
  online.resolve(bundle); await Promise.all([read, download])
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect((await store.hydrate('test')).items).toEqual([])
  if (action !== 'dispose') {
    await library.request(701, true)
    expect((await store.hydrate('test')).items[0].bundle).toEqual(bundle)
  }
})
it('removal during the durable follow-up prevents late persistence', async () => {
  const { library, api, store } = setup(), online = deferred<Bundle>(), saved = deferred<Bundle>()
  api.bundle.mockReturnValueOnce(online.promise).mockReturnValueOnce(saved.promise)
  const read = library.request(701, false); await ticks()
  const download = library.request(701, true); await ticks()
  online.resolve(bundle); await read; await ticks()
  expect(api.bundle).toHaveBeenCalledTimes(2)
  await library.remove(701); saved.resolve(bundle); await download
  expect((await store.hydrate('test')).items).toEqual([])
})
