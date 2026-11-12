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
it('shares the full server pause across catalog and bundles, adds positive jitter and deduplicates waiters', async () => {
  const { api, library } = setup()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 60000))
  const refresh = library.refresh(); await ticks()
  const request = library.request(701, true), duplicate = library.request(701, true)
  await ticks()
  expect(library.getSnapshot()).toMatchObject({ error: 'rate-limited', checkedAt: null })
  expect(api.bundle).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(60000)
  expect(api.catalog).toHaveBeenCalledTimes(1); expect(api.bundle).not.toHaveBeenCalled()
  await jest.advanceTimersByTimeAsync(1)
  await Promise.all([refresh, request, duplicate])
  expect(api.catalog).toHaveBeenCalledTimes(2); expect(api.bundle).toHaveBeenCalledTimes(1)
  expect(library.getSnapshot().error).toBeUndefined()
})
it('uses the fallback and bounds positive jitter at one second', async () => {
  const { api, library } = setup()
  jest.mocked(Math.random).mockReturnValue(0.999999)
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited'))
  const pending = library.refresh(); await ticks()
  await jest.advanceTimersByTimeAsync(60999)
  expect(api.catalog).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1); await pending
  expect(api.catalog).toHaveBeenCalledTimes(2)
})
it('repeated 429 stops automatic recovery, lifecycle checks do not resume it, explicit Refresh still honors the new deadline', async () => {
  const { api, library } = setup()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 100)).mockRejectedValueOnce(new LibraryError('rate-limited', 200))
  const refresh = library.refresh(); await ticks()
  await jest.advanceTimersByTimeAsync(101); await refresh
  expect(api.catalog).toHaveBeenCalledTimes(2)
  await jest.advanceTimersByTimeAsync(10000); await library.refresh()
  expect(api.catalog).toHaveBeenCalledTimes(2)
  const explicit = library.refresh(true); await explicit
  expect(api.catalog).toHaveBeenCalledTimes(3)
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 100)).mockRejectedValueOnce(new LibraryError('rate-limited', 200))
  const second = library.refresh(true); await ticks(); await jest.advanceTimersByTimeAsync(101); await second
  const resumed = library.refresh(true); await ticks(); await jest.advanceTimersByTimeAsync(200)
  expect(api.catalog).toHaveBeenCalledTimes(5)
  await jest.advanceTimersByTimeAsync(1); await resumed
  expect(api.catalog).toHaveBeenCalledTimes(6)
})
it.each(['cancel', 'dispose', 'remove'] as const)('%s cancels waiting work and never recreates abandoned download intent', async action => {
  const { api, library, store } = setup()
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 60000))
  const pending = library.request(701, true); await ticks()
  if (action === 'remove') await library.remove(701)
  else library[action]()
  await pending
  expect(jest.getTimerCount()).toBe(0)
  await jest.advanceTimersByTimeAsync(120000)
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect((await store.hydrate('test')).items.every(item => item.bundle === null)).toBe(true)
})
it('cancels catalog retry timers on background and gates a later foreground refresh', async () => {
  const { api, library } = setup()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 60000))
  const first = library.refresh(); await ticks(); library.cancel(); await first
  expect(jest.getTimerCount()).toBe(0)
  const next = library.refresh(); await ticks(); await jest.advanceTimersByTimeAsync(60000)
  expect(api.catalog).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1); await next
  expect(api.catalog).toHaveBeenCalledTimes(2)
})
it('keeps saved copies and verification unchanged on repeated 429, then explicit Sync still directly verifies', async () => {
  const { api, library } = setup()
  await library.request(701, true)
  const saved = library.getSnapshot().items[0]
  api.bundle.mockRejectedValueOnce(new LibraryError('rate-limited', 100)).mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const update = library.sync(); await ticks(); await jest.advanceTimersByTimeAsync(101); await update
  expect(library.getSnapshot().items[0]).toEqual(saved)
  expect(library.getSnapshot().failures[701]).toBe('rate-limited')
  expect(library.getSnapshot().revoked).toEqual([])
  await jest.advanceTimersByTimeAsync(101)
  api.bundle.mockResolvedValueOnce(null)
  await library.sync()
  expect(api.bundle.mock.calls.at(-1)?.[2]).toBe(bundle.revision)
  expect(library.getSnapshot().items[0].verifiedAt).toBe(Date.now())
})
it('never shortens long delays or lets manual work bypass the pause; other environments are independent', async () => {
  const { api, library, store } = setup()
  const delay = 2147483647 + 10000
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', delay))
  const pending = library.refresh(); await ticks()
  const other = createLibrary('other', api, store)
  await other.refresh()
  expect(api.catalog).toHaveBeenCalledTimes(2)
  await jest.advanceTimersByTimeAsync(2147483647)
  expect(api.catalog).toHaveBeenCalledTimes(2)
  await jest.advanceTimersByTimeAsync(10000)
  expect(api.catalog).toHaveBeenCalledTimes(2)
  await jest.advanceTimersByTimeAsync(1); await pending
  expect(api.catalog).toHaveBeenCalledTimes(3)
})
it('uses one retry budget across every catalog page rather than one budget per request', async () => {
  const { api, library } = setup()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
    .mockResolvedValueOnce({ ...catalog, next_after_id: 701 })
    .mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const pending = library.refresh(); await ticks(); await jest.advanceTimersByTimeAsync(101); await pending
  expect(api.catalog).toHaveBeenCalledTimes(3)
  expect(library.getSnapshot()).toMatchObject({ error: 'rate-limited', checkedAt: null, catalog: [], recommended: [] })
  await jest.advanceTimersByTimeAsync(10000)
  expect(api.catalog).toHaveBeenCalledTimes(3)
})
it('explicit seven-item Sync sends seven conditionals even when catalog revisions match or IDs are absent', async () => {
  const { api, library } = setup()
  api.bundle.mockImplementation(async id => parseBundle({ ...fixture, liturgy: { ...fixture.liturgy, id }, parts: fixture.parts.map(part => ({ ...part, liturgy_id: id })) }))
  await Promise.all(Array.from({ length: 7 }, (_, i) => library.request(701 + i, true)))
  const saved = library.getSnapshot().items
  await jest.advanceTimersByTimeAsync(10000)
  await library.refresh()
  expect(library.getSnapshot().items).toEqual(saved)
  api.bundle.mockClear(); api.bundle.mockResolvedValue(null)
  await library.sync()
  expect(api.bundle).toHaveBeenCalledTimes(7)
  expect(api.bundle.mock.calls.map(([id, , revision]) => [id, revision]).sort()).toEqual(Array.from({ length: 7 }, (_, i) => [701 + i, bundle.revision]))
  expect(library.getSnapshot().items).toHaveLength(7)
})
it('extends an existing wait when an in-flight partner receives a later pause', async () => {
  const { api, library } = setup(), partner = deferred<Bundle>()
  api.bundle.mockReturnValueOnce(partner.promise.then(() => { throw new LibraryError('rate-limited', 200) }))
  const request = library.request(701, false); await ticks()
  api.catalog.mockRejectedValueOnce(new LibraryError('rate-limited', 100))
  const refresh = library.refresh(); await ticks()
  await jest.advanceTimersByTimeAsync(50)
  partner.resolve(bundle); await ticks()
  await jest.advanceTimersByTimeAsync(51)
  expect(api.bundle).toHaveBeenCalledTimes(1); expect(api.catalog).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(149)
  expect(api.bundle).toHaveBeenCalledTimes(1); expect(api.catalog).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1); await Promise.all([request, refresh])
  expect(api.bundle).toHaveBeenCalledTimes(2); expect(api.catalog).toHaveBeenCalledTimes(2)
})
it('derives ranked recommendations only from terminal first pages and preserves good metadata on failure', async () => {
  const { api, library } = setup()
  const first = catalog.liturgies[0]
  const items = [{ ...first, id: 703, recommended_rank: 3 }, { ...first, id: 702, recommended_rank: null }, { ...first, recommended_rank: 1 }]
  api.catalog.mockResolvedValueOnce({ ...catalog, liturgies: items })
  await library.refresh()
  expect(api.catalog).toHaveBeenCalledTimes(1)
  expect(library.getSnapshot().recommended.map(item => item.id)).toEqual([701, 703])
  const snapshot = library.getSnapshot()
  api.catalog.mockResolvedValueOnce({ ...catalog, liturgies: [], next_after_id: 700 }).mockRejectedValueOnce(new LibraryError('network'))
  await library.refresh(true)
  expect(library.getSnapshot()).toMatchObject({ catalog: snapshot.catalog, recommended: snapshot.recommended, checkedAt: snapshot.checkedAt, error: 'network' })
})
