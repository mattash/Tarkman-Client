import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import fixture from './fixtures/public_liturgies/bundle.json'
import catalogFixture from './fixtures/public_liturgies/catalog.json'
import { createLibrary } from '../features/library/downloadCoordinator'
import { LibraryError, parseBundle, parseCatalog, type Bundle, type Catalog } from '../features/library/contracts'
import { deferred, memoryStore, ticks } from './library-test-helpers'
const bundle = parseBundle(fixture), catalog = parseCatalog(catalogFixture)
function setup() {
  const api = {
    catalog: jest.fn<(signal: AbortSignal, after?: number, recommended?: boolean) => Promise<Catalog>>(async () => catalog),
    bundle: jest.fn<(id: number, signal: AbortSignal, revision?: string) => Promise<Bundle | null>>(async () => bundle),
  }
  const store = memoryStore(), library = createLibrary('test', api, store)
  return { api, store, library }
}
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1000); jest.spyOn(Math, 'random').mockReturnValue(0) })
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })
it('catalog abandonment cancels its retry, but preserves an explicit download and its timer', async () => {
  const { api, library } = setup()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const refresh = library.refresh(); await ticks()
  const save = library.request(701, true); await ticks()
  library.cancelRefresh(); await refresh
  expect(library.getSnapshot().loading).toBe(false)
  await jest.advanceTimersByTimeAsync(101); await save
  expect(api.catalog).toHaveBeenCalledTimes(1)
  expect(library.getSnapshot().items[0].bundle).toEqual(bundle)
})
it('abandoning the last online reader cancels its retry and settles its caller promptly', async () => {
  const { api, library, store } = setup(), reader = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const read = library.request(701, false, reader.signal); await ticks()
  reader.abort(); expect(await read).toBeUndefined(); await ticks()
  expect(jest.getTimerCount()).toBe(0)
  await jest.advanceTimersByTimeAsync(1000)
  expect(api.bundle).toHaveBeenCalledTimes(1); expect(store.rows.size).toBe(0)
})
it('one abandoned online reader cannot cancel another same-ID reader', async () => {
  const { api, library } = setup(), first = new AbortController(), second = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const a = library.request(701, false, first.signal), b = library.request(701, false, second.signal)
  await ticks(); first.abort(); expect(await a).toBeUndefined()
  expect(api.bundle.mock.calls[0][1].aborted).toBe(false)
  await jest.advanceTimersByTimeAsync(101)
  expect(await b).toEqual(bundle); expect(api.bundle).toHaveBeenCalledTimes(2)
})
it('an explicit durable claimant preserves a paused online job and coalesces its saved follow-up', async () => {
  const { api, library, store } = setup(), reader = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const read = library.request(701, false, reader.signal); await ticks()
  const save = library.request(701, true), duplicate = library.request(701, true); await ticks()
  reader.abort(); expect(await read).toBeUndefined()
  await jest.advanceTimersByTimeAsync(101); await Promise.all([save, duplicate])
  expect(api.bundle).toHaveBeenCalledTimes(3)
  expect((await store.hydrate('test')).items[0].bundle).toEqual(bundle)
})
it('abandoning a reader coalesced with a saved transfer never cancels the save', async () => {
  const { api, library } = setup(), reader = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const save = library.request(701, true); await ticks()
  const read = library.request(701, false, reader.signal); await ticks()
  reader.abort(); await read
  await jest.advanceTimersByTimeAsync(101); await save
  expect(library.getSnapshot().items[0].bundle).toEqual(bundle)
})
it('global background cancellation still discards durable follow-up after a read lease is released', async () => {
  const { api, library, store } = setup(), reader = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const read = library.request(701, false, reader.signal); await ticks()
  const save = library.request(701, true); await ticks(); reader.abort(); library.cancel()
  await Promise.all([read, save]); await jest.advanceTimersByTimeAsync(1000)
  expect(api.bundle).toHaveBeenCalledTimes(1); expect(store.rows.size).toBe(0)
})
it('abandonment during hydration never starts catalog or online HTTP work', async () => {
  const { api, store } = setup(), loaded = deferred<Awaited<ReturnType<typeof store.hydrate>>>(), reader = new AbortController()
  store.hydrate = () => loaded.promise
  const library = createLibrary('test', api, store)
  const refresh = library.refresh(), read = library.request(701, false, reader.signal)
  library.cancelRefresh(); reader.abort(); loaded.resolve({ items: [], dismissed: false, corrupt: 0 })
  await Promise.all([refresh, read])
  expect(api.catalog).not.toHaveBeenCalled(); expect(api.bundle).not.toHaveBeenCalled()
})
it('immediate online refocus does not coalesce into a settling abandoned request', async () => {
  const { api, library } = setup(), reader = new AbortController()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const read = library.request(701, false, reader.signal); await ticks()
  reader.abort()
  const resumed = library.request(701, false, new AbortController().signal)
  await read; await ticks(); await jest.advanceTimersByTimeAsync(101)
  expect(await resumed).toEqual(bundle); expect(api.bundle).toHaveBeenCalledTimes(2)
})
it('late abandoned catalog results cannot publish or clear a new foreground metadata operation', async () => {
  const { api, library } = setup(), first = deferred<Catalog>(), second = deferred<Catalog>()
  api.catalog.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const a = library.refresh(); await ticks(); library.cancelRefresh()
  const b = library.refresh(); await ticks()
  first.resolve(catalog); await a
  expect(library.getSnapshot()).toMatchObject({ loading: true, checkedAt: null, catalog: [] })
  const duplicate = library.refresh(); await ticks()
  expect(api.catalog).toHaveBeenCalledTimes(2)
  second.resolve(catalog); await Promise.all([b, duplicate])
  expect(library.getSnapshot()).toMatchObject({ loading: false, checkedAt: 1000, catalog: catalog.liturgies })
})
