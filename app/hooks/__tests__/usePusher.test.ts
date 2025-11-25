import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePusher } from '../usePusher'

// Mock Pusher
const mockBind = vi.fn()
const mockUnbind = vi.fn()
const mockSubscribe = vi.fn(() => ({
  bind: mockBind,
  unbind: mockUnbind,
}))
const mockUnsubscribe = vi.fn()

vi.mock('pusher-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}))

describe('usePusher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with null data', () => {
    const { result } = renderHook(() => usePusher('test-channel', 'test-event'))

    expect(result.current).toBeNull()
  })

  it('should subscribe to channel on mount', () => {
    renderHook(() => usePusher('test-channel', 'test-event'))

    expect(mockSubscribe).toHaveBeenCalledWith('test-channel')
    expect(mockBind).toHaveBeenCalledWith('test-event', expect.any(Function))
  })

  it('should update data when event is received', async () => {
    const { result } = renderHook(() => usePusher('test-channel', 'test-event'))

    // Get the callback function that was passed to bind
    const eventCallback = mockBind.mock.calls[0][1]

    const mockData = { part: 'test-part-id' }

    // Simulate receiving data
    act(() => {
      eventCallback(mockData)
    })

    // Wait for the state update
    await waitFor(() => {
      expect(result.current).toEqual(mockData)
    })
  })

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => usePusher('test-channel', 'test-event'))

    unmount()

    expect(mockUnbind).toHaveBeenCalledWith('test-event')
    expect(mockUnsubscribe).toHaveBeenCalledWith('test-channel')
  })

  it('should resubscribe when channel changes', () => {
    const { rerender } = renderHook(
      ({ channel, event }) => usePusher(channel, event),
      {
        initialProps: { channel: 'channel-1', event: 'test-event' },
      }
    )

    expect(mockSubscribe).toHaveBeenCalledWith('channel-1')

    // Change the channel
    rerender({ channel: 'channel-2', event: 'test-event' })

    // Should unsubscribe from old channel and subscribe to new one
    expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1')
    expect(mockSubscribe).toHaveBeenCalledWith('channel-2')
  })

  it('should resubscribe when event changes', () => {
    const { rerender } = renderHook(
      ({ channel, event }) => usePusher(channel, event),
      {
        initialProps: { channel: 'test-channel', event: 'event-1' },
      }
    )

    expect(mockBind).toHaveBeenCalledWith('event-1', expect.any(Function))

    vi.clearAllMocks()

    // Change the event
    rerender({ channel: 'test-channel', event: 'event-2' })

    // Should unbind old event and bind to new one
    expect(mockUnbind).toHaveBeenCalledWith('event-1')
    expect(mockBind).toHaveBeenCalledWith('event-2', expect.any(Function))
  })
})
