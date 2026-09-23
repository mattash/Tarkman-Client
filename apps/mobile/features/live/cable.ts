import type { CableSubscriptionIdentifier } from '@tarkman/core'
import { record } from './contracts'
export interface CableCallbacks { connected(): void; disconnected(): void; received(value: unknown): void }
export interface CableClient { subscribe(url: string, sessionId: number | CableSubscriptionIdentifier, callbacks: CableCallbacks): () => void }
export interface Socket {
  readyState: number; protocol: string; send(data: string): void; close(): void
  onopen: WebSocket['onopen']; onclose: WebSocket['onclose']; onerror: WebSocket['onerror']
  onmessage: WebSocket['onmessage']
}
export type SocketFactory = (url: string, protocols: string[]) => Socket
// Rails' public actioncable-v1-json protocol, using RN's supported WebSocket.
// No DOM globals, bearer auth headers, or global monkey patches. The adapter
// owns one watchdog/retry timer; its disposer closes every owned resource.
export function createCable(factory: SocketFactory = (url, protocols) => new WebSocket(url, protocols)): CableClient {
  return { subscribe(url, sessionId, callbacks) {
    const identifier = JSON.stringify(typeof sessionId === 'number' ? { channel: 'SessionChannel', id: sessionId } : sessionId)
    let socket: Socket | null = null, disposed = false, blocked = false, confirmed = false
    let lastMessage = 0, openedAt = 0, retryAt = 0, attempts = 0
    function close() {
      if (socket) { socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null; socket.close(); socket = null }
      confirmed = false
    }
    function lost() {
      close(); callbacks.disconnected()
      retryAt = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5))
    }
    function open() {
      if (disposed || blocked) return
      openedAt = lastMessage = Date.now()
      try {
        socket = factory(url, ['actioncable-v1-json'])
        socket.onopen = () => { if (socket?.protocol !== 'actioncable-v1-json') { blocked = true; lost() } }
        socket.onclose = lost; socket.onerror = lost
        socket.onmessage = event => {
          try {
            if (typeof event.data !== 'string') return
            const frame = record(JSON.parse(event.data))
            lastMessage = Date.now()
            if (frame.type === 'welcome') socket?.send(JSON.stringify({ command: 'subscribe', identifier }))
            else if (frame.type === 'disconnect') { blocked = frame.reconnect === false; lost() }
            else if (frame.identifier === identifier) {
              if (frame.type === 'confirm_subscription') { confirmed = true; attempts = 0; callbacks.connected() }
              else if (frame.type === 'reject_subscription') { blocked = true; lost() }
              else if (confirmed && 'message' in frame) callbacks.received(frame.message)
            }
          } catch { /* Malformed frames never become application state. */ }
        }
      } catch { lost() }
    }
    open()
    const timer = setInterval(() => {
      if (socket && (Date.now() - lastMessage > 10000 || (!confirmed && Date.now() - openedAt > 10000))) lost()
      else if (!socket && Date.now() >= retryAt) open()
    }, 1000)
    return () => { if (disposed) return; disposed = true; clearInterval(timer); close() }
  } }
}
