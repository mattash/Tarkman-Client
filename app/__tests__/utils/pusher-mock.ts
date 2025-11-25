import { vi } from 'vitest'

export interface MockPusherChannel {
  bind: ReturnType<typeof vi.fn>
  unbind: ReturnType<typeof vi.fn>
  unbind_all: ReturnType<typeof vi.fn>
  trigger: (event: string, data: any) => void
}

export interface MockPusher {
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  channels: {
    [key: string]: MockPusherChannel
  }
}

export function createMockPusherChannel(): MockPusherChannel {
  const eventHandlers: Map<string, Set<Function>> = new Map()

  return {
    bind: vi.fn((event: string, callback: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
      }
      eventHandlers.get(event)!.add(callback)
    }),
    unbind: vi.fn((event: string, callback?: Function) => {
      if (callback) {
        eventHandlers.get(event)?.delete(callback)
      } else {
        eventHandlers.delete(event)
      }
    }),
    unbind_all: vi.fn(() => {
      eventHandlers.clear()
    }),
    trigger: (event: string, data: any) => {
      const handlers = eventHandlers.get(event)
      if (handlers) {
        handlers.forEach((handler) => handler(data))
      }
    },
  }
}

export function createMockPusher(): MockPusher {
  const channels: { [key: string]: MockPusherChannel } = {}

  return {
    subscribe: vi.fn((channelName: string) => {
      if (!channels[channelName]) {
        channels[channelName] = createMockPusherChannel()
      }
      return channels[channelName]
    }),
    unsubscribe: vi.fn((channelName: string) => {
      delete channels[channelName]
    }),
    disconnect: vi.fn(() => {
      Object.keys(channels).forEach((key) => delete channels[key])
    }),
    channels,
  }
}

export function mockPusherConstructor() {
  const pusher = createMockPusher()
  return vi.fn(() => pusher)
}

// Helper to emit events on a channel
export function emitPusherEvent(
  pusher: MockPusher,
  channelName: string,
  event: string,
  data: any
) {
  const channel = pusher.channels[channelName]
  if (channel) {
    channel.trigger(event, data)
  }
}
