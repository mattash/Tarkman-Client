import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createCable, type Socket } from '../features/live/cable'
let sockets: Socket[]
beforeEach(() => { jest.useFakeTimers(); sockets = [] })
afterEach(() => { jest.useRealTimers() })
function setup() {
  const factory = jest.fn<(url: string, protocols: string[]) => Socket>(() => {
    const socket: Socket = { readyState: 1, protocol: 'actioncable-v1-json', send: jest.fn(), close: jest.fn(), onopen: null, onclose: null, onerror: null, onmessage: null }
    sockets.push(socket); return socket
  })
  const callbacks = { connected: jest.fn(), disconnected: jest.fn(), received: jest.fn() }
  const stop = createCable(factory).subscribe('wss://example.test/cable', 7, callbacks)
  return { factory, callbacks, stop }
}
function frame(value: unknown, socket = sockets.at(-1)!) { socket.onmessage?.call(socket as WebSocket, { data: JSON.stringify(value) } as MessageEvent) }
const identifier = JSON.stringify({ channel: 'SessionChannel', id: 7 })
it('subscribes only after welcome and recovers on every subscription confirmation', () => {
  const { callbacks, factory, stop } = setup()
  expect(factory).toHaveBeenCalledWith('wss://example.test/cable', ['actioncable-v1-json'])
  expect(sockets[0].send).not.toHaveBeenCalled()
  frame({ type: 'welcome' })
  expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ command: 'subscribe', identifier }))
  frame({ identifier: 'wrong', message: { event: 'part_change' } }); expect(callbacks.received).not.toHaveBeenCalled()
  frame({ identifier, type: 'confirm_subscription' }); expect(callbacks.connected).toHaveBeenCalledTimes(1)
  frame({ identifier, message: { event: 'part_change', data: { session: 7 } } }); expect(callbacks.received).toHaveBeenCalledTimes(1)
  stop(); stop(); expect(sockets[0].close).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0)
})
it('detects silent sockets, reconnects, and removes old callbacks', async () => {
  const { callbacks, stop } = setup()
  frame({ type: 'welcome' }); frame({ identifier, type: 'confirm_subscription' })
  await jest.advanceTimersByTimeAsync(12000)
  expect(callbacks.disconnected).toHaveBeenCalled(); expect(sockets).toHaveLength(2)
  expect(sockets[0].onmessage).toBeNull()
  frame({ type: 'welcome' }); frame({ identifier, type: 'confirm_subscription' })
  expect(callbacks.connected).toHaveBeenCalledTimes(2)
  stop(); await jest.advanceTimersByTimeAsync(60000); expect(sockets).toHaveLength(2)
})
it.each([{ type: 'reject_subscription', identifier }, { type: 'disconnect', reconnect: false }])('honors server rejection without a retry storm', async payload => {
  const { callbacks, stop } = setup(); frame(payload)
  await jest.advanceTimersByTimeAsync(60000)
  expect(callbacks.disconnected).toHaveBeenCalledTimes(1); expect(sockets).toHaveLength(1)
  stop()
})
it('does not let pings hide a subscription that was never confirmed', async () => {
  const { stop } = setup()
  for (let i = 0; i < 4; i++) { frame({ type: 'ping', message: 123 }); await jest.advanceTimersByTimeAsync(3000) }
  expect(sockets).toHaveLength(2); stop()
})
it('supports typed token subscriptions with the same framing, confirmation and disposal', () => {
  const socket: Socket = { readyState: 1, protocol: 'actioncable-v1-json', send: jest.fn(), close: jest.fn(), onopen: null, onclose: null, onerror: null, onmessage: null }
  const callbacks = { connected: jest.fn(), disconnected: jest.fn(), received: jest.fn() }
  const identifier = JSON.stringify({ channel: 'DisplayLinkChannel', token: 'token-A' })
  const stop = createCable(() => socket).subscribe('wss://example.test/cable', { channel: 'DisplayLinkChannel', token: 'token-A' }, callbacks)
  frame({ type: 'welcome' }, socket)
  expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ command: 'subscribe', identifier }))
  frame({ type: 'confirm_subscription', identifier }, socket)
  frame({ identifier, message: { event: 'display_link.updated' } }, socket)
  expect(callbacks.connected).toHaveBeenCalledTimes(1); expect(callbacks.received).toHaveBeenCalledTimes(1)
  stop(); expect(socket.close).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0)
})
