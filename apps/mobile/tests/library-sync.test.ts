import { it, expect, jest } from '@jest/globals'
import fixture from './fixtures/public_liturgies/bundle.json'
import changed from './fixtures/public_liturgies/bundle_updated.json'
import catalog from './fixtures/public_liturgies/catalog.json'
import omitted from './fixtures/public_liturgies/catalog_content_error_page.json'
import { createApi } from '../features/library/api'
import { createLibrary } from '../features/library/downloadCoordinator'
import { LibraryError, parseBundle, parseCatalog, type Bundle } from '../features/library/contracts'
import { memoryStore, deferred, ticks } from './library-test-helpers'
const bundle = parseBundle(fixture), updated = parseBundle(changed)
function setup() {
  const store = memoryStore(), api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn<(id: number, signal: AbortSignal, revision?: string) => Promise<Bundle | null>>(async () => bundle) }
  return { store, api, library: createLibrary('test', api, store, () => 1000) }
}
it('catalog success and unrelated local success do not clear a failed hydration', async () => {
  const { library, store } = setup()
  const hydrate = store.hydrate
  store.hydrate = async () => { throw new Error('SQLite load failed') }
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ storageError: 'storage', error: undefined, checkedAt: 1000 })
  await library.remove(701)
  await library.dismiss()
  expect(library.getSnapshot().storageError).toBe('storage')
  store.hydrate = hydrate
  await library.hydrate()
  expect(library.getSnapshot().storageError).toBeUndefined()
})
it('hydration recovery and removal of another ID do not clear a failed removal', async () => {
  const { library, store, api } = setup()
  const hydrate = store.hydrate, remove = store.remove
  store.hydrate = async () => { throw new Error('SQLite load failed') }
  store.remove = async () => { throw new Error('SQLite removal failed') }
  await expect(library.remove(701)).rejects.toMatchObject({ code: 'storage' })
  store.hydrate = hydrate
  api.catalog.mockRejectedValue(new LibraryError('network'))
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ storageError: 'storage', error: 'network' })
  store.remove = remove
  await library.remove(702)
  expect(library.getSnapshot().storageError).toBe('storage')
  await library.remove(701)
  expect(library.getSnapshot().storageError).toBeUndefined()
  expect(library.getSnapshot().error).toBe('network')
})
it('successful removal of all saved services clears outstanding removal failures', async () => {
  const { library, store } = setup()
  const remove = store.remove
  store.remove = async () => { throw new Error('SQLite removal failed') }
  await expect(library.remove(701)).rejects.toMatchObject({ code: 'storage' })
  await expect(library.remove()).rejects.toMatchObject({ code: 'storage' })
  store.remove = remove
  await library.remove()
  expect(library.getSnapshot().storageError).toBeUndefined()
})
it('dismissal failure survives catalog refresh and clears after a successful retry', async () => {
  const { library, store } = setup()
  const dismiss = store.dismiss
  store.dismiss = async () => { throw new Error('SQLite dismissal failed') }
  await library.dismiss(); await library.refresh()
  expect(library.getSnapshot().storageError).toBe('storage')
  store.dismiss = dismiss
  await library.dismiss()
  expect(library.getSnapshot()).toMatchObject({ storageError: undefined, dismissed: true })
})
it('entry, recommendation metadata and Skip never transfer content; dismissal survives controller recreation', async () => {
  const { library, api, store } = setup()
  await library.refresh(); await library.refresh(); await library.dismiss()
  expect(api.bundle).not.toHaveBeenCalled(); expect(api.catalog).toHaveBeenCalledTimes(1)
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

function catalogResponse(body: unknown): Response {
  return { status: 200, ok: true, headers: { get: () => null }, text: async () => JSON.stringify(body) } as unknown as Response
}
it('continues omitted-content pages exactly once for recommendations and explicit catalog pagination', async () => {
  const fetcher = jest.fn<typeof fetch>().mockImplementation(async url => {
    const after = new URL(String(url)).searchParams.get('after_id')
    return catalogResponse(after === null ? omitted : catalog)
  })
  const store = memoryStore(), library = createLibrary('test', createApi('https://example.test', fetcher), store, () => 1000)
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ catalog: [], next: 700, recommended: parseCatalog(catalog).liturgies, loading: false, error: undefined })
  await library.refresh(false, true)
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ catalog: parseCatalog(catalog).liturgies, next: null, loading: false, error: undefined })
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://example.test/public/liturgies.json?limit=100',
    'https://example.test/public/liturgies.json?limit=100&recommended=true',
    'https://example.test/public/liturgies.json?limit=100&after_id=700&recommended=true',
    'https://example.test/public/liturgies.json?limit=100&after_id=700',
  ])
  expect(store.rows.size).toBe(0)
})
it.each([699, 700])('stops recommendation pagination on nonadvancing omitted-content cursor %s', async next => {
  const fetcher = jest.fn<typeof fetch>()
    .mockResolvedValueOnce(catalogResponse({ ...catalog, next_after_id: 701 }))
    .mockResolvedValueOnce(catalogResponse(omitted))
    .mockResolvedValue(catalogResponse({ ...omitted, next_after_id: next }))
  const library = createLibrary('test', createApi('https://example.test', fetcher), memoryStore())
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ error: 'invalid', loading: false, checkedAt: null })
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it('retains the 100-page recommendation cap even for advancing empty pages', async () => {
  const fetcher = jest.fn<typeof fetch>().mockImplementation(async url => {
    const params = new URL(String(url)).searchParams
    return catalogResponse(params.has('recommended') ? { ...omitted, next_after_id: Number(params.get('after_id')) + 1 } : { ...catalog, next_after_id: 701 })
  })
  const library = createLibrary('test', createApi('https://example.test', fetcher), memoryStore())
  await library.refresh()
  expect(library.getSnapshot()).toMatchObject({ error: 'capacity', loading: false, checkedAt: null })
  expect(fetcher).toHaveBeenCalledTimes(101)
})

it.each([699, 700])('rejects nonadvancing catalog continuation %s without retrying or losing its cursor', async next => {
  const fetcher = jest.fn<typeof fetch>()
    .mockResolvedValueOnce(catalogResponse(omitted))
    .mockResolvedValueOnce(catalogResponse(catalog))
    .mockResolvedValue(catalogResponse({ ...omitted, next_after_id: next }))
  const library = createLibrary('test', createApi('https://example.test', fetcher), memoryStore(), () => 1000)
  await library.refresh()
  await library.refresh(false, true)
  expect(library.getSnapshot()).toMatchObject({ catalog: [], next: 700, error: 'invalid', loading: false, checkedAt: 1000 })
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it('checks only the requested copy when a revision is unchanged, never rehydrating every saved bundle', async () => {
  const { library, api, store } = setup()
  await library.request(701, true)
  const hydrate = jest.spyOn(store, 'hydrate'), intact = jest.spyOn(store, 'intact')
  api.bundle.mockResolvedValueOnce(null); await library.request(701, true)
  api.bundle.mockResolvedValueOnce(bundle); await library.request(701, true)
  expect(hydrate).not.toHaveBeenCalled()
  expect(intact.mock.calls).toEqual([['test', 701], ['test', 701]])
  expect(library.getSnapshot().status[701]).toBeUndefined()
})

it('settles a withdrawn liturgy whose saved copy cannot be deleted instead of leaving it busy', async () => {
  const { library, api, store } = setup()
  await library.request(701, true)
  store.remove = async () => { throw new LibraryError('storage') }
  api.bundle.mockRejectedValueOnce(new LibraryError('unavailable')); await library.request(701, true)
  const snapshot = library.getSnapshot()
  expect(snapshot.status[701]).toBe('failed'); expect(snapshot.failures[701]).toBe('unavailable')
  expect(snapshot.storageError).toBe('storage'); expect(snapshot.revoked).toEqual([701])
  expect(snapshot.items[0].bundle).toEqual(bundle)
})

it('a catalog check stopped by cancellation shows no error, and an error never survives the next ordinary check', async () => {
  const { library, api } = setup()
  await library.refresh()
  const aborted = deferred<never>()
  // setup() types catalog without parameters; the coordinator still passes its AbortSignal.
  const abortable = (signal: AbortSignal) => { signal.addEventListener('abort', () => aborted.resolve(undefined as never)); return aborted.promise.then(() => { throw new Error('AbortError') }) }
  api.catalog.mockImplementationOnce(abortable as never)
  const stopped = library.refresh(true); await ticks(); library.cancel(); await stopped
  expect(library.getSnapshot().error).toBeUndefined()
  api.catalog.mockRejectedValueOnce(new LibraryError('network')); await library.refresh(true)
  expect(library.getSnapshot().error).toBe('network')
  const calls = api.catalog.mock.calls.length
  await library.refresh()
  expect(api.catalog.mock.calls.length).toBeGreaterThan(calls); expect(library.getSnapshot().error).toBeUndefined()
  await library.refresh()
  expect(api.catalog.mock.calls.length).toBe(calls + 1)
})
