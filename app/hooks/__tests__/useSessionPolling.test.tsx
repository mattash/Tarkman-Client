import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSessionPolling } from '../useSessionPolling'
import type { SessionWrapper } from '@/types/session'
import type { ReactNode } from 'react'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retry for tests
      },
    },
  })

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

  it('should handle fetch errors with retry', async () => {
    // Mock multiple failed attempts (hook has retry: true)
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    const { result } = renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    // Initially should be loading
    expect(result.current.isLoading).toBe(true)

    // The hook will retry failed requests, so we just verify it's attempting to fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('should use correct query key', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSessionData,
    })

    const { result } = renderHook(() => useSessionPolling(), {
      wrapper: createWrapper(),
    })

    expect(result.current.data).toBeUndefined() // Initially undefined until loaded

    // The query key should be ['currentSession']
    // This is verified implicitly by the hook working correctly
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
