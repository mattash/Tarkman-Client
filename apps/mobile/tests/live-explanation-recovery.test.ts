import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createReaderController, type ReaderCache } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableCallbacks } from '../features/live/cable'
import { normalizeParts, normalizeSession, type LiveExplanation } from '../features/live/contracts'

const parts = normalizeParts({ parts: [
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 11, position: 1, en: 'First' } },
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 12, position: 2, en: 'Repeated' } },
] })
const session = normalizeSession({ session: { id: 7, current_part_id: 1, current_liturgy_id: 10, current_part_position: 1,
  status: 'active', parts_context: 'fixture', num_of_parts: 2, liturgies: [{ id: 10, position: 1 }] } })
const next = { ...session, currentPosition: 2 }
const explanation: LiveExplanation = { id: 1, title: 'First explanation', description: null, liturgyPartId: 11, contentFingerprint: '["First explanation",null]' }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
let api: jest.Mocked<ReaderApi>, save: jest.Mock<ReaderCache['save']>, callbacks: CableCallbacks
let lifecycleEvent: (active: boolean, online: boolean) => void, stop: () => void
beforeEach(() => {
  jest.useFakeTimers()
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]),
    session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts),
    explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([explanation]) }
  save = jest.fn<ReaderCache['save']>()
})
afterEach(() => { stop?.(); jest.useRealTimers() })
function setup(loadExplanations = true) {
  const controller = createReaderController(api, { subscribe: (_url, _id, cb) => { callbacks = cb; return () => {} } },
    'wss://example.test', { listen: cb => { lifecycleEvent = cb; return () => {} } }, 7, { save }, loadExplanations)
  stop = controller.start()
  return controller
}
function navigate() { callbacks.received({ event: 'part_change', data: { session: 7 } }) }

it('shows and saves the reading while explanations are still pending, without waiting or showing an error', async () => {
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValue(pending.promise)
  const controller = setup(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session, parts, loading: false, refreshing: false,
    stale: false, error: null, explanationError: false, explanationsLoading: true, explanations: [] })
  expect(save).toHaveBeenCalledWith({ session, parts, explanations: undefined })
  pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot()).toMatchObject({ explanations: [explanation], explanationsLoading: false })
  expect(save).toHaveBeenLastCalledWith({ session, parts, explanations: { liturgyPartId: 11, items: [explanation] } })
  expect(api.session).toHaveBeenCalledTimes(2)
})
it('does not request explanations for the controller during initial load, navigation, reconnect, retry or polling', async () => {
  const controller = setup(false); await flush()
  callbacks.connected(); await flush()
  api.session.mockResolvedValue(next); navigate(); await flush()
  controller.retry(); await flush()
  await jest.advanceTimersByTimeAsync(30000)
  expect(api.explanations).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ session: next, explanationsLoading: false, explanationError: false })
})
it('cancels old explanations and rejects late results when the same part ID occurs twice', async () => {
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValueOnce(pending.promise).mockResolvedValue([{ ...explanation, id: 2, liturgyPartId: 12 }])
  const controller = setup(); await flush()
  const signal = api.explanations.mock.calls[0][1]
  api.session.mockResolvedValue(next); navigate(); await flush()
  expect(signal.aborted).toBe(true)
  pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session: next, explanations: [{ ...explanation, id: 2, liturgyPartId: 12 }] })
  expect(save).toHaveBeenLastCalledWith({ session: next, parts, explanations: { liturgyPartId: 12, items: [{ ...explanation, id: 2, liturgyPartId: 12 }] } })
})
it.each(['stop', 'offline', 'background'] as const)('cancels explanation work on %s and ignores late responses', async reason => {
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValue(pending.promise)
  const controller = setup(); await flush()
  if (reason === 'stop') stop()
  else lifecycleEvent(reason !== 'background', reason !== 'offline')
  const savedCount = save.mock.calls.length
  expect(api.explanations.mock.calls[0][1].aborted).toBe(true)
  pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot().explanations).toEqual([])
  expect(save).toHaveBeenCalledTimes(savedCount)
  expect(jest.getTimerCount()).toBe(0)
})
it('limits an explanation failure to its own state and can recover on retry', async () => {
  api.explanations.mockRejectedValueOnce(new Error('unavailable'))
  const controller = setup(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session, stale: false, error: null, explanationError: true, explanationsLoading: false })
  controller.retry(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session, stale: false, error: null, explanationError: false, explanations: [explanation] })
})
it('times out explanations without making the reading stale and rejects a late success', async () => {
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValue(pending.promise)
  const controller = setup(); await flush()
  await jest.advanceTimersByTimeAsync(12000)
  expect(api.explanations.mock.calls[0][1].aborted).toBe(true)
  expect(controller.getSnapshot()).toMatchObject({ stale: false, error: null, explanationError: true, explanationsLoading: false })
  pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot().explanations).toEqual([])
  expect(save).toHaveBeenCalledTimes(1)
})
it('checks untagged legacy explanations in the background before attaching them', async () => {
  const verification = deferred<typeof session>()
  api.explanations.mockResolvedValue([{ ...explanation, liturgyPartId: null }])
  api.session.mockResolvedValueOnce(session).mockResolvedValueOnce(session).mockReturnValueOnce(verification.promise)
  const controller = setup(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session, stale: false, refreshing: false, explanationsLoading: true, explanations: [] })
  verification.resolve(session); await flush()
  expect(controller.getSnapshot().explanations).toEqual([{ ...explanation, liturgyPartId: null }])
})
it('discards untagged explanations if the current occurrence changed without a cable notification', async () => {
  api.explanations.mockResolvedValueOnce([{ ...explanation, liturgyPartId: null }]).mockResolvedValue([])
  api.session.mockResolvedValueOnce(session).mockResolvedValueOnce(session).mockResolvedValue(next)
  const controller = setup(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ session: next, explanations: [], stale: false })
  expect(save.mock.calls.some(([input]) => input.explanations?.items.some(item => item.id === explanation.id))).toBe(false)
})
it('changes explanation loading without resetting manual mode, occurrence or the manifest', async () => {
  const controller = setup(false); await flush()
  controller.dispatch({ type: 'manual' })
  const before = controller.getSnapshot(), partsReads = api.parts.mock.calls.length, sessionReads = api.session.mock.calls.length
  controller.setLoadExplanations(true); await flush()
  expect(api.explanations).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot()).toMatchObject({ following: false, session: before.session, parts: before.parts, explanations: [explanation] })
  controller.setLoadExplanations(false); await flush()
  expect(controller.getSnapshot().explanations).toEqual([])
  expect(api.parts).toHaveBeenCalledTimes(partsReads); expect(api.session).toHaveBeenCalledTimes(sessionReads)
})

it('retains legacy verified same-context explanations throughout ordinary refresh without flicker', async () => {
  const controller = setup(); await flush(); callbacks.connected(); await flush()
  const seen: string[] = []
  controller.subscribe(() => seen.push(controller.getSnapshot().explanationProvenance.status))
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValueOnce(pending.promise)
  controller.retry(); await flush()
  expect(controller.getSnapshot().explanations).toEqual([explanation])
  expect(controller.getSnapshot().explanationProvenance.status).toBe('revalidating')
  expect(seen.every(status => status === 'revalidating')).toBe(true)
  pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot().explanationProvenance.status).toBe('ready')
})
it('clears unknown-context proof at recovery start and disconnect invalidates a pending ticket', async () => {
  api.session.mockResolvedValue({ ...session, partsContext: null })
  const controller = setup(); await flush(); callbacks.connected(); await flush()
  const pending = deferred<LiveExplanation[]>()
  api.explanations.mockReturnValue(pending.promise)
  controller.retry()
  expect(controller.getSnapshot().explanations).toEqual([])
  await flush(); callbacks.disconnected()
  expect(controller.getSnapshot().explanations).toEqual([])
  lifecycleEvent(false, true); pending.resolve([explanation]); await flush()
  expect(controller.getSnapshot().explanationProvenance.status).toBe('invalid')
})
