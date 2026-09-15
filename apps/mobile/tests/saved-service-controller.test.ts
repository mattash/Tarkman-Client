import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createReaderController, type Lifecycle, type ReaderCache } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableCallbacks, CableClient } from '../features/live/cable'
import { normalizeSession, normalizeParts } from '../features/live/contracts'

const session = normalizeSession({ session: { id: 7, current_part_id: 1 } })
const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, liturgy_part_id: 11, en: 'Text' } }] })
const explanation = { id: 1, title: 'Title', description: 'Text', liturgyPartId: 11 }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
let api: jest.Mocked<ReaderApi>, cache: { save: jest.Mock<ReaderCache['save']> }
let cable: CableClient, callbacks: CableCallbacks, lifecycle: Lifecycle, lifecycleEvent: (active: boolean, online: boolean) => void
beforeEach(() => {
  jest.useFakeTimers()
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([explanation]) }
  cache = { save: jest.fn<ReaderCache['save']>() }
  cable = { subscribe: (_url, _id, cb) => { callbacks = cb; return () => {} } }
  lifecycle = { listen: cb => { lifecycleEvent = cb; return () => {} } }
})
afterEach(() => { jest.useRealTimers() })
function setup(id: number | null = 7) { const controller = createReaderController(api, cable, 'wss://example.test/cable', lifecycle, id, cache); return { controller, stop: controller.start() } }

it('T-06: saves filtered content only after the second authoritative read and recovered dispatch', async () => {
  const second = deferred<typeof session>()
  api.session.mockResolvedValueOnce(session).mockReturnValueOnce(second.promise)
  api.explanations.mockResolvedValue([explanation, { ...explanation, id: 2, liturgyPartId: 99 }])
  const { controller, stop } = setup()
  cache.save.mockImplementation(() => { expect(controller.getSnapshot()).toMatchObject({ loading: false, stale: false, session, parts }) })
  await flush(); expect(cache.save).not.toHaveBeenCalled()
  second.resolve(session); await flush()
  expect(cache.save).toHaveBeenCalledTimes(1)
  expect(cache.save).toHaveBeenCalledWith({ session, parts, explanations: { liturgyPartId: 11, items: [explanation] } })
  stop()
})
it.each(['services', 'session', 'parts'] as const)('T-06: does not save after %s failure', async endpoint => {
  api[endpoint].mockRejectedValueOnce(new Error('down'))
  const { controller, stop } = setup(); await flush()
  expect(controller.getSnapshot().error).not.toBeNull(); expect(cache.save).not.toHaveBeenCalled(); stop()
})
it.each([null, 7])('T-06: does not save discovery or empty parts (route %s)', async id => {
  api.parts.mockResolvedValue([])
  const { controller, stop } = setup(id); await flush()
  expect(controller.getSnapshot().loading).toBe(false); expect(cache.save).not.toHaveBeenCalled(); stop()
})
it('does not save a response for a different session', async () => {
  api.session.mockResolvedValue({ ...session, id: 8 })
  const { controller, stop } = setup(); await flush()
  expect(controller.getSnapshot().error).not.toBeNull(); expect(cache.save).not.toHaveBeenCalled(); stop()
})
it.each(['torn', 'event'] as const)('T-06: discards %s snapshots and saves only the consistent rerun', async reason => {
  const first = deferred<typeof session>(), rerun = deferred<typeof session>()
  const changed = { ...session, currentPartId: 2 }
  api.session.mockReturnValueOnce(first.promise).mockResolvedValueOnce(reason === 'torn' ? changed : session).mockReturnValueOnce(rerun.promise)
  const { controller, stop } = setup()
  if (reason === 'event') callbacks.received({ event: 'part_change', data: { session: 7 } })
  first.resolve(session); await flush()
  expect(cache.save).not.toHaveBeenCalled(); expect(controller.getSnapshot().stale).toBe(true)
  rerun.resolve(session); await flush()
  expect(cache.save).toHaveBeenCalledTimes(1); stop()
})
it.each(['stop', 'offline', 'background'] as const)('does not save late results from a generation invalidated by %s', async reason => {
  const second = deferred<typeof session>()
  api.session.mockResolvedValueOnce(session).mockReturnValueOnce(second.promise)
  const { stop } = setup(); await flush()
  if (reason === 'stop') stop()
  else lifecycleEvent(reason !== 'background', reason !== 'offline')
  second.resolve(session); await flush()
  expect(cache.save).not.toHaveBeenCalled(); stop()
})
it('rechecks generation after a recovered subscriber unmounts the controller', async () => {
  const { controller, stop } = setup()
  controller.subscribe(() => { if (controller.getSnapshot().session) stop() })
  await flush(); expect(controller.getSnapshot().session).toEqual(session); expect(cache.save).not.toHaveBeenCalled()
})
it.each(['throw', 'reject', 'pending'] as const)('cache %s does not alter recovery or block subsequent recoveries', async mode => {
  cache.save.mockImplementation(() => {
    if (mode === 'throw') throw new Error('storage')
    return mode === 'reject' ? Promise.reject(new Error('storage')) : new Promise<void>(() => {})
  })
  const { controller, stop } = setup(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ loading: false, stale: false, error: null, session, parts })
  controller.retry(); await flush()
  expect(cache.save).toHaveBeenCalledTimes(2); expect(controller.getSnapshot().error).toBeNull(); stop()
})
it('T-07: requests preservation on explanation failure, but writes a successful empty response', async () => {
  api.explanations.mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
  const { controller, stop } = setup(); await flush()
  expect(cache.save).toHaveBeenLastCalledWith({ session, parts, explanations: undefined })
  expect(controller.getSnapshot()).toMatchObject({ explanationError: true, explanations: [], error: null })
  controller.retry(); await flush()
  expect(cache.save).toHaveBeenLastCalledWith({ session, parts, explanations: { liturgyPartId: 11, items: [] } }); stop()
})
