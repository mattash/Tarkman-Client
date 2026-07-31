import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSessionPolling } from '../useSessionPolling'
import type { SessionWrapper } from '@/types/session'
import type { ReactNode } from 'react'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retry for tests
        gcTime: 0,
      },
    },
  })

const createWrapper = (queryClient = createQueryClient()) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return Wrapper
}

const mockSessionData: SessionWrapper = {
  session: {
    id: 1,
    liturgy: 'Divine Liturgy',
    liturgy_id: 1,
    date: '2024-03-20',
    church_name: 'St. Mary',
    church_avatar: 'https://example.com/avatar.jpg',
    occupied: true,
    num_of_parts: 10,
    current_part_position: 5,
    current_part_id: 123,
    current_liturgy_id: 1,
    page: 1,
    posture: 'standing',
    readings: {
      gospel: 'John 3:16',
      epistle: 'Romans 8:28',
    },
    options: {
      gospel: 'John 3:16',
      epistle: 'Romans 8:28',
      before_message: 'Before message',
      after_message: 'After message',
    },
  },
}

describe('useSessionPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch current session successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSessionData,
    })

    const { result } = renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSessionData)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/current.json'),
      expect.objectContaining({
        headers: {
          'X-Polling-Client': 'true',
        },
      })
    )
  })

  it('should return null for inactive session', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'inactive' }),
    })

    const { result } = renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('should recover when a retry succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      })

    const { result } = renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(
      () => {
        expect(result.current.data).toEqual(mockSessionData)
      },
      { timeout: 2500 },
    )
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should cache the result under the current-session query key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSessionData,
    })
    const queryClient = createQueryClient()

    renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(['currentSession'])).toEqual(mockSessionData)
    })
  })

  it('does not fetch while disabled and starts when enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSessionData,
    })
    let enabled = false

    const { result, rerender } = renderHook(
      () => useSessionPolling({ enabled }),
      { wrapper: createWrapper() },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    enabled = true
    rerender()

    await waitFor(() => {
      expect(result.current.data).toEqual(mockSessionData)
    })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('should include X-Polling-Client header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSessionData,
    })

    renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[1]).toHaveProperty('headers')
    expect(fetchCall[1].headers).toHaveProperty('X-Polling-Client', 'true')
  })
})
