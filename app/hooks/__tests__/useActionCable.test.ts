import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useActionCable } from '../useActionCable'
import { createConsumer } from '@rails/actioncable'
import type { MockActionCableEnvelope } from '@/__tests__/utils/actioncable-mock'

// Global handler storage for the mock
let capturedHandler: ((e: MockActionCableEnvelope) => void) | null = null

// Mock @rails/actioncable at the top level
vi.mock('@rails/actioncable', () => ({
  createConsumer: vi.fn(() => ({
    subscriptions: {
      create: (_id: unknown, handlers: { received?: (e: MockActionCableEnvelope) => void }) => {
        capturedHandler = handlers.received ?? null
        return {
          subscribe: vi.fn(),
          unsubscribe: vi.fn(),
        }
      },
    },
    disconnect: vi.fn(),
  })),
}))

// Helper to emit events in tests
function emitEvent(envelope: MockActionCableEnvelope) {
  if (capturedHandler) {
    capturedHandler(envelope)
  }
}

describe('useActionCable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = null
  })

  it('should initialize with null data', () => {
    const { result } = renderHook(() =>
      useActionCable('channel_123', 'part_change')
    )
    expect(result.current).toBeNull()
  })

  it('should subscribe to SessionChannel on mount', async () => {
    renderHook(() =>
      useActionCable('channel_123', 'part_change')
    )
    // Effect runs async — flush pending microtasks
    await waitFor(() => {})
    // Handler should now be captured
    expect(capturedHandler).not.toBeNull()
  })

  it('should update data when matching event is received', async () => {
    const { result } = renderHook(() =>
      useActionCable('channel_456', 'part_change')
    )
    await waitFor(() => {})

    act(() => {
      emitEvent({ event: 'part_change', data: { part: 'test-part-id' } })
    })

    await waitFor(() => {
      expect(result.current).toEqual({ part: 'test-part-id' })
    })
  })

  it('should ignore events that do not match the subscribed event name', async () => {
    const { result } = renderHook(() =>
      useActionCable('channel_789', 'part_change')
    )
    await waitFor(() => {})

    act(() => {
      emitEvent({ event: 'status_change', data: { status: 'paused' } })
    })

    // Give React a moment — data should still be null
    await waitFor(() => {}, { timeout: 100 })
    expect(result.current).toBeNull()
  })

  it('should handle status_change event', async () => {
    const { result } = renderHook(() =>
      useActionCable('channel_321', 'status_change')
    )
    await waitFor(() => {})

    act(() => {
      emitEvent({
        event: 'status_change',
        data: { status: 'live', status_message: 'Service in progress' },
      })
    })

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'live',
        status_message: 'Service in progress',
      })
    })
  })

  it('should support multiple event names as array', async () => {
    const { result } = renderHook(() =>
      useActionCable('channel_multi', ['part_change', 'status_change'])
    )
    await waitFor(() => {})

    act(() => {
      emitEvent({ event: 'status_change', data: { status: 'paused' } })
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'paused' })
    })
  })

  it('does not expose the previous channel payload while switching channels', async () => {
    const { result, rerender } = renderHook(
      ({ channelName }) => useActionCable(channelName, 'part_change'),
      { initialProps: { channelName: 'channel_first' } },
    )
    await waitFor(() => {})

    act(() => {
      emitEvent({ event: 'part_change', data: { part: 'first-part' } })
    })
    expect(result.current).toEqual({ part: 'first-part' })

    rerender({ channelName: 'channel_second' })

    expect(result.current).toBeNull()
  })

  it('should convert pusher-style channel name to SessionChannel params', async () => {
    let capturedId: unknown = null
    const mockConsumer = {
      subscriptions: {
        create: (id: unknown) => {
          capturedId = id
          return { subscribe: vi.fn(), unsubscribe: vi.fn() }
        },
      },
      disconnect: vi.fn(),
    }
    vi.mocked(createConsumer).mockReturnValueOnce(mockConsumer as unknown as ReturnType<typeof createConsumer>)

    renderHook(() => useActionCable('channel_999', 'part_change'))
    await waitFor(() => {})

    expect(capturedId).toEqual({ channel: 'SessionChannel', id: '999' })
  })

  it('should parse JSON ActionCable identifiers into params', async () => {
    let capturedId: unknown = null
    const mockConsumer = {
      subscriptions: {
        create: (id: unknown) => {
          capturedId = id
          return { subscribe: vi.fn(), unsubscribe: vi.fn() }
        },
      },
      disconnect: vi.fn(),
    }
    vi.mocked(createConsumer).mockReturnValueOnce(mockConsumer as unknown as ReturnType<typeof createConsumer>)

    renderHook(() => useActionCable('{"channel":"SessionChannel","id":"999"}', 'part_change'))
    await waitFor(() => {})

    expect(capturedId).toEqual({ channel: 'SessionChannel', id: '999' })
  })
})
