import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createReaderController, type Lifecycle } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableCallbacks, CableClient } from '../features/live/cable'
import { normalizeSession } from '../features/live/contracts'
const session = normalizeSession({ session: { id: 7, current_part_id: 1 } })
let api: jest.Mocked<ReaderApi>, callbacks: CableCallbacks, lifecycleEvent: (active: boolean, online: boolean) => void
let unsubscribe: ReturnType<typeof jest.fn>, unlisten: ReturnType<typeof jest.fn>, cable: CableClient, lifecycle: Lifecycle
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
beforeEach(() => {
  jest.useFakeTimers()
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue([]), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
  unsubscribe = jest.fn(); unlisten = jest.fn()
  cable = { subscribe: jest.fn<CableClient['subscribe']>().mockImplementation((_url, _id, cb) => { callbacks = cb; return unsubscribe }) }
  lifecycle = { listen: cb => { lifecycleEvent = cb; return unlisten } }
})
afterEach(() => { jest.useRealTimers() })
function setup(id: number | null = 7) { const controller = createReaderController(api, cable, 'wss://example.test/cable', lifecycle, id); return { controller, stop: controller.start() } }
it('recovers on connect, all events, polling, network and foreground without duplicate subscriptions', async () => {
  const { controller, stop } = setup(); await flush()
  expect(controller.getSnapshot().session?.id).toBe(7)
  callbacks.connected(); await flush()
  expect(api.parts).toHaveBeenCalledTimes(2)
  for (const event of ['part_change', 'status_change', 'explanation_updated']) {
    callbacks.received({ event, data: { session: 7, session_id: 7 } }); await flush()
  }
  expect(api.parts).toHaveBeenCalledTimes(5)
  callbacks.received({ event: 'part_change', data: { session: 8 } }); await flush()
  expect(api.parts).toHaveBeenCalledTimes(5)
  await jest.advanceTimersByTimeAsync(30000); expect(api.parts).toHaveBeenCalledTimes(6)
  lifecycleEvent(false, true); expect(unsubscribe).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(60000); expect(api.parts).toHaveBeenCalledTimes(6)
  lifecycleEvent(true, true); await flush()
  lifecycleEvent(true, true); await flush()
  expect(cable.subscribe).toHaveBeenCalledTimes(2)
  lifecycleEvent(true, false); lifecycleEvent(true, true); await flush()
  expect(api.parts).toHaveBeenCalledTimes(8)
  stop(); expect(unlisten).toHaveBeenCalledTimes(1); expect(unsubscribe).toHaveBeenCalledTimes(3); expect(jest.getTimerCount()).toBe(0)
})
it('coalesces event bursts and discards late requests from the previous mounted session', async () => {
  let resolve!: (value: typeof session) => void
  api.session.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const { controller, stop } = setup()
  callbacks.connected(); callbacks.received({ event: 'part_change', data: { session: 7 } })
  expect(api.parts).toHaveBeenCalledTimes(1)
  resolve(session); await flush(); expect(api.parts).toHaveBeenCalledTimes(2)
  controller.dispatch({ type: 'manual' }); callbacks.connected(); await flush()
  expect(controller.getSnapshot().following).toBe(false)
  stop()
  const next = setup(8); await flush()
  expect(next.controller.getSnapshot().session).toBeNull()
  expect(next.controller.getSnapshot().error).not.toBeNull()
  next.stop()
})
it('does not publish a snapshot when the part changes while requests are in flight', async () => {
  const changed = { ...session, currentPartId: 2 }
  api.session.mockResolvedValueOnce(session).mockResolvedValue(changed)
  const { controller, stop } = setup(); await flush()
  expect(api.parts).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot().session?.currentPartId).toBe(2)
  stop()
})
it('keeps readings on failure, separates explanation failure, and reports service leaving live discovery', async () => {
  const { controller, stop } = setup(); await flush()
  api.explanations.mockRejectedValueOnce(new Error('down'))
  api.services.mockResolvedValue([])
  controller.retry(); await flush()
  expect(controller.getSnapshot().listed).toBe(false); expect(controller.getSnapshot().explanationError).toBe(true)
  api.parts.mockRejectedValueOnce(new Error('down')); controller.retry(); await flush()
  expect(controller.getSnapshot().session?.id).toBe(7); expect(controller.getSnapshot().stale).toBe(true)
  controller.retry(); await flush(); expect(controller.getSnapshot().error).toBeNull()
  stop()
})
it('discovery handles the empty state without opening a cable', async () => {
  api.services.mockResolvedValue([])
  const { controller, stop } = setup(null); await flush()
  expect(controller.getSnapshot().loading).toBe(false); expect(controller.getSnapshot().services).toEqual([])
  expect(cable.subscribe).not.toHaveBeenCalled(); stop()
})
it('times out a stalled read and leaves no request timeout after disposal', async () => {
  api.session.mockImplementationOnce((_id, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))))
  const { controller, stop } = setup()
  await jest.advanceTimersByTimeAsync(12000); await flush()
  expect(controller.getSnapshot().loading).toBe(false); expect(controller.getSnapshot().error).not.toBeNull()
  controller.retry(); await flush(); expect(controller.getSnapshot().error).toBeNull()
  stop(); expect(jest.getTimerCount()).toBe(0)
})
it('ignores a late successful response after route disposal', async () => {
  let resolve!: (value: typeof session) => void
  api.session.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const { controller, stop } = setup(); stop()
  expect(jest.getTimerCount()).toBe(0)
  resolve(session); await flush()
  expect(controller.getSnapshot().session).toBeNull()
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})
it('shows an explicit offline state on first mount and recovers on network restoration', async () => {
  lifecycle.listen = cb => { lifecycleEvent = cb; cb(true, false); return unlisten }
  const { controller, stop } = setup()
  expect(controller.getSnapshot().loading).toBe(false)
  expect(controller.getSnapshot().error).toContain('No network connection')
  expect(api.services).not.toHaveBeenCalled(); expect(cable.subscribe).not.toHaveBeenCalled()
  lifecycleEvent(true, true); await flush()
  expect(controller.getSnapshot().session?.id).toBe(7); expect(controller.getSnapshot().error).toBeNull()
  stop()
})
