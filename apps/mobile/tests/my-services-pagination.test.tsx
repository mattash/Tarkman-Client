import { expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { fetchMyServices, normalizeMyServicesPage } from '../features/services/api'
import { useMyServices } from '../features/services/useMyServices'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { deferred, respond } from './auth-helpers'

const first = '/s.json?pagination=cursor&limit=20'
const later = `${first}&cursor=next%2B%2F%3D`
const envelope = (ids: number[], cursor: string | null = null) => ({
  sessions: ids.map(id => ({ session: { id, liturgy: `Service ${id}` } })),
  page: { limit: 20, has_more: cursor !== null, next_cursor: cursor },
})
const request = () => jest.fn<AuthContextValue['authorizedFetch']>()
const ids = (services: { id: number }[]) => services.map(service => service.id)

it('normalizes legacy, empty legacy, and cursor pages without truncation', () => {
  const body = envelope(Array.from({ length: 24 }, (_, i) => 24 - i), 'next+/=')
  expect(normalizeMyServicesPage(body)).toMatchObject({ nextCursor: 'next+/=' })
  expect(normalizeMyServicesPage(body).services).toHaveLength(24)
  expect(normalizeMyServicesPage({ sessions: body.sessions }).services).toHaveLength(24)
  expect(normalizeMyServicesPage({ sessions: body.sessions }).nextCursor).toBeNull()
  expect(normalizeMyServicesPage({ error: 'No sessions found' })).toEqual({ services: [], nextCursor: null })
  expect(normalizeMyServicesPage(envelope([]))).toEqual({ services: [], nextCursor: null })
})

it.each([null, {}, { sessions: null }, { sessions: [{ session: { id: 'bad' } }] },
  { ...envelope([1]), page: null }, { ...envelope([1]), page: { limit: 20, has_more: true, next_cursor: null } },
  { ...envelope([1]), page: { limit: 20, has_more: 'true', next_cursor: 'x' } },
  { ...envelope([1]), page: { limit: 0, has_more: false, next_cursor: null } },
])('rejects malformed envelopes: %j', body => {
  expect(() => normalizeMyServicesPage(body)).toThrow()
})

it('loads page one, suppresses concurrent end events, appends in order, and stops at the end', async () => {
  const pending = deferred<Response>()
  const next = deferred<Response>()
  const fetcher = request().mockReturnValueOnce(pending.promise).mockReturnValueOnce(next.promise)
  const { result } = await renderHook(() => useMyServices(fetcher))
  expect(result.current.loading).toBe(true)
  await act(async () => { void result.current.loadMore(); void result.current.loadMore() })
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => { pending.resolve(respond(200, envelope([30, 29], 'next+/='))) })
  expect(fetcher.mock.calls[0][0]).toBe(first)
  await act(async () => { void result.current.loadMore(); void result.current.loadMore() })
  expect(result.current.loadingMore).toBe(true)
  expect(ids(result.current.services)).toEqual([30, 29])
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[1][0]).toBe(later)
  await act(async () => { next.resolve(respond(200, envelope([29, 28]))) })
  expect(ids(result.current.services)).toEqual([30, 29, 28])
  expect(result.current.nextCursor).toBeNull()
  await act(async () => { await result.current.loadMore() })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('retains cards and the cursor on load-more failure, waiting for explicit Retry', async () => {
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([9], 'next+/=')))
    .mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(respond(200, envelope([8])))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.loadMore() })
  expect(ids(result.current.services)).toEqual([9])
  expect(result.current.loadMoreError).toBe('Offline')
  await act(async () => { await result.current.loadMore() })
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { await result.current.retryLoadMore() })
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([first, later, later])
  expect(ids(result.current.services)).toEqual([9, 8])
  expect(result.current.loadMoreError).toBeNull()
})

it('keeps loaded pages during refresh and failure, replacing only on success', async () => {
  const pending = deferred<Response>()
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([9], 'next+/=')))
    .mockResolvedValueOnce(respond(200, envelope([8])))
    .mockReturnValueOnce(pending.promise).mockResolvedValueOnce(respond(200, envelope([10], 'new')))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.loadMore() })
  await act(async () => { void result.current.refresh() })
  expect(result.current.refreshing).toBe(true)
  expect(ids(result.current.services)).toEqual([9, 8])
  await act(async () => { pending.resolve(respond(500)) })
  expect(ids(result.current.services)).toEqual([9, 8])
  expect(result.current.error).toBeTruthy()
  expect(result.current.refreshing).toBe(false)
  await act(async () => { await result.current.retry() })
  expect(ids(result.current.services)).toEqual([10])
  expect(result.current.nextCursor).toBe('new')
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([first, later, first, first])
})

it.each([true, false])('recovers an invalid cursor once; successful recovery: %s', async success => {
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([9], 'next+/=')))
    .mockResolvedValueOnce(respond(400, { error: 'invalid_cursor' }))
    .mockResolvedValueOnce(success ? respond(200, envelope([10])) : respond(400, { error: 'invalid_cursor' }))
    .mockResolvedValueOnce(respond(200, envelope([11])))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.loadMore() })
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([first, later, first])
  expect(ids(result.current.services)).toEqual(success ? [10] : [9])
  if (!success) {
    expect(result.current.error).toBeTruthy()
    await act(async () => { await result.current.loadMore() })
    expect(fetcher).toHaveBeenCalledTimes(3)
    await act(async () => { await result.current.retry() })
    expect(fetcher.mock.calls[3][0]).toBe(first)
    expect(ids(result.current.services)).toEqual([11])
  }
})

it('offers ordinary page-one retry for initial errors', async () => {
  const fetcher = request().mockResolvedValueOnce(respond(400, { error: 'other' }))
    .mockResolvedValueOnce(respond(200, envelope([1])))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.error).toBeTruthy())
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => { await result.current.retry() })
  expect(ids(result.current.services)).toEqual([1])
  expect(result.current.error).toBeNull()
})

it('rejects a non-advancing cursor', async () => {
  const fetcher = request().mockResolvedValue(respond(200, envelope([1], 'same')))
  await expect(fetchMyServices(fetcher, new AbortController().signal, 'same')).rejects.toThrow('Unexpected services pagination.')
})

it('aborts on cleanup and ignores a late response from the previous fetcher', async () => {
  const pending = deferred<Response>()
  const old = request().mockReturnValue(pending.promise)
  const next = request().mockResolvedValue(respond(200, envelope([2])))
  const { result, rerender, unmount } = await renderHook(({ fetcher }: { fetcher: AuthContextValue['authorizedFetch'] }) => useMyServices(fetcher), { initialProps: { fetcher: old } })
  await rerender({ fetcher: next })
  await waitFor(() => expect(ids(result.current.services)).toEqual([2]))
  expect(old.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => { pending.resolve(respond(200, envelope([1]))) })
  expect(ids(result.current.services)).toEqual([2])
  await unmount()
})

it.each([['A'], ['A', 'B']])('rejects repeated cursors in chain %j even on explicit retries', async (...chain: string[]) => {
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([10], chain[0])))
  for (const cursor of chain.slice(1)) fetcher.mockResolvedValueOnce(respond(200, envelope([9], cursor)))
  fetcher.mockResolvedValue(respond(200, envelope([8], 'A')))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  for (let i = 1; i < chain.length; i++) await act(async () => { await result.current.loadMore() })
  const before = ids(result.current.services)
  await act(async () => { await result.current.loadMore() })
  expect(result.current.loadMoreError).toBe('Unexpected services pagination.')
  expect(ids(result.current.services)).toEqual(before)
  const calls = fetcher.mock.calls.length
  await act(async () => { await result.current.loadMore() })
  expect(fetcher).toHaveBeenCalledTimes(calls)
  await act(async () => { await result.current.retryLoadMore() })
  expect(result.current.loadMoreError).toBe('Unexpected services pagination.')
  expect(ids(result.current.services)).toEqual(before)
})

it.each(['refresh', 'recovery'])('resets cursor history after successful %s only', async mode => {
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([10], 'A')))
    .mockResolvedValueOnce(respond(200, envelope([9], 'B')))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.loadMore() })
  // A failed page preserves the previously seen A cursor.
  fetcher.mockRejectedValueOnce(new Error('Offline'))
  await act(async () => { await result.current.loadMore() })
  fetcher.mockResolvedValueOnce(respond(200, envelope([8], 'A')))
  await act(async () => { await result.current.retryLoadMore() })
  expect(result.current.loadMoreError).toBe('Unexpected services pagination.')
  if (mode === 'recovery') fetcher.mockResolvedValueOnce(respond(400, { error: 'invalid_cursor' }))
  fetcher.mockResolvedValueOnce(respond(200, envelope([20], 'B')))
    .mockResolvedValueOnce(respond(200, envelope([19], 'A')))
  await act(async () => { await (mode === 'refresh' ? result.current.refresh() : result.current.retryLoadMore()) })
  await act(async () => { await result.current.loadMore() })
  expect(result.current.loadMoreError).toBeNull()
  expect(ids(result.current.services)).toEqual([20, 19])
})

it('reconciles after a mutation from page one, so a late load-more page can never append', async () => {
  const late = deferred<Response>()
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([9], 'next+/=')))
    .mockReturnValueOnce(late.promise).mockResolvedValueOnce(respond(200, envelope([12, 9], 'fresh')))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { void result.current.loadMore() })
  expect(result.current.loadingMore).toBe(true)
  await act(async () => { await result.current.reconcile() })
  expect(fetcher.mock.calls[1][1]?.signal?.aborted).toBe(true)
  await act(async () => { late.resolve(respond(200, envelope([8]))) })
  expect(ids(result.current.services)).toEqual([12, 9])
  expect(result.current.nextCursor).toBe('fresh')
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([first, later, first])
})

it('keeps the cursor chain when a reconciling refresh fails', async () => {
  const fetcher = request().mockResolvedValueOnce(respond(200, envelope([9], 'next+/='))).mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(respond(200, envelope([8])))
  const { result } = await renderHook(() => useMyServices(fetcher))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.reconcile() })
  expect(result.current.error).toBe('Offline')
  expect(result.current.nextCursor).toBe('next+/=')
  expect(ids(result.current.services)).toEqual([9])
})
