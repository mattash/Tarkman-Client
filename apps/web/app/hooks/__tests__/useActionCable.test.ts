import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useActionCable, useActionCableState } from '../useActionCable'
import { createConsumer } from '@rails/actioncable'
import type { MockActionCableEnvelope } from '@/__tests__/utils/actioncable-mock'

interface CapturedSubscription {
  identifier: unknown
  handler: ((e: MockActionCableEnvelope) => void) | null
  connected: (() => void) | null
  disconnected: (() => void) | null
  unsubscribe: ReturnType<typeof vi.fn>
}

let capturedSubscriptions: CapturedSubscription[] = []
const disconnect = vi.fn()

// Mock @rails/actioncable at the top level
vi.mock('@rails/actioncable', () => ({
  createConsumer: vi.fn(() => ({
    subscriptions: {
      create: (identifier: unknown, handlers: { received?: (e: MockActionCableEnvelope) => void; connected?: () => void; disconnected?: () => void }) => {
        const subscription = {
          identifier,
          handler: handlers.received ?? null,
          connected: handlers.connected ?? null,
          disconnected: handlers.disconnected ?? null,
          unsubscribe: vi.fn(),
        }
        capturedSubscriptions.push(subscription)
        return subscription
      },
    },
    disconnect,
  })),
}))

// Helper to emit events in tests
function emitEvent(envelope: MockActionCableEnvelope, subscriptionIndex = 0) {
  capturedSubscriptions[subscriptionIndex]?.handler?.(envelope)
}

describe('useActionCable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSubscriptions = []
  })

  it('should initialize with null data', () => {
    const { result } = renderHook(() =>
      useActionCable('channel_123', 'part_change')
    )
    expect(result.current).toBeNull()
  })

  it('exposes connected and disconnected callbacks', async () => {
    const { result } = renderHook(() => useActionCableState('channel_connection', 'part_change'))
    await waitFor(() => expect(capturedSubscriptions).toHaveLength(1))
    expect(result.current.connected).toBe(false)
    act(() => capturedSubscriptions[0].connected?.())
    expect(result.current.connected).toBe(true)
    act(() => capturedSubscriptions[0].disconnected?.())
    expect(result.current.connected).toBe(false)
  })

  it('should subscribe to SessionChannel on mount', async () => {
    renderHook(() =>
      useActionCable('channel_123', 'part_change')
    )
    // Effect runs async — flush pending microtasks
    await waitFor(() => {})
    // Handler should now be captured
    expect(capturedSubscriptions[0]?.handler).not.toBeNull()
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

  it('shares a channel subscription until its final listener unmounts', async () => {
    const partHook = renderHook(() =>
      useActionCable('channel_shared', 'part_change')
    )
    const statusHook = renderHook(() =>
      useActionCable('channel_shared', 'status_change')
    )
    await waitFor(() => {
      expect(capturedSubscriptions).toHaveLength(1)
    })

    expect(createConsumer).toHaveBeenCalledTimes(1)

    act(() => {
      emitEvent({ event: 'part_change', data: { part: 'shared-part' } })
    })
    expect(partHook.result.current).toEqual({ part: 'shared-part' })
    expect(statusHook.result.current).toBeNull()

    partHook.unmount()
    expect(capturedSubscriptions[0].unsubscribe).not.toHaveBeenCalled()
    expect(disconnect).not.toHaveBeenCalled()

    act(() => {
      emitEvent({ event: 'status_change', data: { status: 'paused' } })
    })
    expect(statusHook.result.current).toEqual({ status: 'paused' })

    statusHook.unmount()
    expect(capturedSubscriptions[0].unsubscribe).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('does not resubscribe when an equivalent event array is recreated', async () => {
    const { rerender } = renderHook(() =>
      useActionCable('channel_stable', ['part_change', 'status_change'])
    )
    await waitFor(() => {
      expect(capturedSubscriptions).toHaveLength(1)
    })

    rerender()

    expect(capturedSubscriptions).toHaveLength(1)
    expect(createConsumer).toHaveBeenCalledTimes(1)
  })

  it('does not reconnect when an equivalent channel identifier is recreated', async () => {
    const { result, rerender } = renderHook(
      ({ channelName }) => useActionCableState(channelName, 'part_change'),
      { initialProps: { channelName: 'channel_999' } },
    )
    await waitFor(() => expect(capturedSubscriptions).toHaveLength(1))
    act(() => capturedSubscriptions[0].connected?.())
    expect(result.current.connected).toBe(true)

    rerender({ channelName: '{"channel":"SessionChannel","id":"999"}' })

    expect(capturedSubscriptions).toHaveLength(1)
    expect(result.current.connected).toBe(true)
  })

  it('shares one consumer across distinct channels', async () => {
    const firstHook = renderHook(() =>
      useActionCable('channel_first', 'part_change')
    )
    const secondHook = renderHook(() =>
      useActionCable('channel_second', 'part_change')
    )
    await waitFor(() => {
      expect(capturedSubscriptions).toHaveLength(2)
    })

    expect(createConsumer).toHaveBeenCalledTimes(1)

    firstHook.unmount()
    expect(capturedSubscriptions[0].unsubscribe).toHaveBeenCalledOnce()
    expect(disconnect).not.toHaveBeenCalled()

    secondHook.unmount()
    expect(capturedSubscriptions[1].unsubscribe).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('keeps subscriptions with different channel parameters separate', async () => {
    const firstHook = renderHook(() =>
      useActionCable('{"channel":"RoomChannel","room":"first"}', 'part_change')
    )
    const secondHook = renderHook(() =>
      useActionCable('{"channel":"RoomChannel","room":"second"}', 'part_change')
    )
    await waitFor(() => {
      expect(capturedSubscriptions).toHaveLength(2)
    })

    expect(capturedSubscriptions[0].identifier).toEqual({
      channel: 'RoomChannel',
      room: 'first',
    })
    expect(capturedSubscriptions[1].identifier).toEqual({
      channel: 'RoomChannel',
      room: 'second',
    })

    firstHook.unmount()
    secondHook.unmount()
  })

  it('should convert pusher-style channel name to SessionChannel params', async () => {
    renderHook(() => useActionCable('channel_999', 'part_change'))
    await waitFor(() => {})

    expect(capturedSubscriptions[0]?.identifier).toEqual({ channel: 'SessionChannel', id: '999' })
  })

  it('should parse JSON ActionCable identifiers into params', async () => {
    renderHook(() => useActionCable('{"channel":"SessionChannel","id":"999"}', 'part_change'))
    await waitFor(() => {})

    expect(capturedSubscriptions[0]?.identifier).toEqual({ channel: 'SessionChannel', id: '999' })
  })
})
