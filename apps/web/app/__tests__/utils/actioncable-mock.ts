import { vi } from 'vitest'

export interface MockActionCableEnvelope {
  event: string
  data: Record<string, unknown>
}

export interface MockSubscription {
  received: (envelope: MockActionCableEnvelope) => void
  subscribe: () => void
  unsubscribe: () => void
}

export interface MockConsumer {
  subscriptions: {
    create: (identifier: unknown, handlers: { received?: (e: MockActionCableEnvelope) => void }) => MockSubscription
  }
  disconnect: () => void
}

let mockReceivedHandler: ((envelope: MockActionCableEnvelope) => void) | null = null

export function createMockSubscription(): MockSubscription {
  return {
    received(envelope: MockActionCableEnvelope) {
      if (mockReceivedHandler) {
        mockReceivedHandler(envelope)
      }
    },
    subscribe() {},
    unsubscribe() {},
  }
}

export function createMockConsumer(): MockConsumer {
  return {
    subscriptions: {
      create(_identifier: unknown, handlers: { received?: (e: MockActionCableEnvelope) => void }) {
        mockReceivedHandler = handlers.received ?? null
        return createMockSubscription()
      },
    },
    disconnect() {},
  }
}

// Helper to emit ActionCable events in tests
export function emitActionCableEvent(envelope: MockActionCableEnvelope) {
  if (mockReceivedHandler) {
    mockReceivedHandler(envelope)
  }
}

// Mock the @rails/actioncable module
vi.mock('@rails/actioncable', () => ({
  createConsumer: vi.fn(() => createMockConsumer()),
}))
