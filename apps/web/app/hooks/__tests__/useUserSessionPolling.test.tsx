import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useUserSessionPolling } from '../useUserSessionPolling'
import { createMockSession } from '@/__tests__/factories'

const mockFetch = vi.fn()
global.fetch = mockFetch

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUserSessionPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stays idle until a user id is available', () => {
    const { result } = renderHook(() => useUserSessionPolling(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('requests the encoded user endpoint with the polling header', async () => {
    const session = createMockSession({ id: 11 })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => session,
    })

    const { result } = renderHook(() => useUserSessionPolling('user/42'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(session)
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/s/user%2F42/current.json'),
      { headers: { 'X-Polling-Client': 'true' } },
    )
  })

  it('maps an inactive response to no current session', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'inactive' }),
    })

    const { result } = renderHook(() => useUserSessionPolling('42'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('switches query ownership when the display-link user changes', async () => {
    const firstSession = createMockSession({ id: 11 })
    const secondSession = createMockSession({ id: 22 })
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => firstSession })
      .mockResolvedValueOnce({ ok: true, json: async () => secondSession })
    let userId = 'first'

    const { result, rerender } = renderHook(
      () => useUserSessionPolling(userId),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual(firstSession)
    })

    userId = 'second'
    rerender()

    await waitFor(() => {
      expect(result.current.data).toEqual(secondSession)
    })
    expect(mockFetch.mock.calls[0][0]).toContain('/s/first/current.json')
    expect(mockFetch.mock.calls[1][0]).toContain('/s/second/current.json')
  })
})
