import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createReaderController } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableCallbacks } from '../features/live/cable'
import { currentPart, normalizeParts, normalizeSession, type LiveSession } from '../features/live/contracts'

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const raw = { id: 7, current_part_id: 1, current_liturgy_id: 10, current_part_position: 1,
  num_of_parts: 4, liturgies: [{ id: 10, position: 1 }, { id: 20, position: 2 }], readings: { gospel: 'original' } }
const session = normalizeSession({ session: raw })
const parts = normalizeParts({ parts: [
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 11, position: 1, en: 'first' } },
  { part: { id: 2, liturgy_id: 10, liturgy_part_id: 12, position: 2, en: 'next' } },
  { part: { id: 1, liturgy_id: 20, liturgy_part_id: 21, position: 3, en: 'repeated' } },
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 13, position: 4, en: 'repeated in same liturgy' } },
] })
let api: jest.Mocked<ReaderApi>, callbacks: CableCallbacks, stop: () => void
beforeEach(() => {
  jest.useFakeTimers()
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]),
    session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts),
    explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
})
afterEach(() => { stop?.(); jest.useRealTimers() })
async function setup() {
  const controller = createReaderController(api, { subscribe: (_url, _id, cb) => { callbacks = cb; return () => {} } },
    'wss://example.test', { listen: () => () => {} }, 7)
  stop = controller.start(); await flush(); callbacks.connected(); await flush()
  for (const mock of Object.values(api)) mock.mockClear()
  return controller
}
function event(event = 'part_change') { callbacks.received({ event, data: { session: 7, session_id: 7 } }) }
function defer<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function next(position = 2) {
  const part = parts[position - 1]
  return normalizeSession({ session: { ...raw, current_part_id: part.id, current_liturgy_id: part.liturgyId, current_part_position: position } })
}

it.each([2, 3, 4])('reuses text but verifies canonical occurrence %i, including repeated parts within/across liturgies', async position => {
  const controller = await setup()
  api.session.mockResolvedValue(next(position))
  event(); await flush()
  const state = controller.getSnapshot()
  expect(currentPart(state.session!, state.parts)?.key).toBe(parts[position - 1].key)
  expect(state.parts).toBe(parts)
  expect(api.parts).not.toHaveBeenCalled(); expect(api.services).not.toHaveBeenCalled()
  expect(api.session).toHaveBeenCalledTimes(2); expect(api.explanations).toHaveBeenCalledTimes(1)
  expect(state.stale).toBe(false)
})
it('uses the same recovery path for a single-liturgy session', async () => {
  const single = { ...raw, num_of_parts: 2, liturgies: [{ id: 10, position: 1 }] }
  api.session.mockResolvedValue(normalizeSession({ session: single }))
  api.parts.mockResolvedValue(parts.slice(0, 2))
  const controller = await setup()
  api.session.mockResolvedValue(normalizeSession({ session: { ...single, current_part_id: 2, current_part_position: 2 } }))
  event(); await flush()
  expect(api.parts).not.toHaveBeenCalled()
  expect(currentPart(controller.getSnapshot().session!, controller.getSnapshot().parts)?.key).toBe('lp:12')
})
it('does not retry navigation when unrelated signed avatar URLs change between authoritative reads', async () => {
  const controller = await setup()
  let request = 0
  api.session.mockImplementation(async () => normalizeSession({ session: { ...raw, current_part_id: 2,
    current_part_position: 2, church_avatar: `https://example.test/avatar?signature=${++request}` } }))
  event(); await flush()
  expect(api.session).toHaveBeenCalledTimes(2)
  expect(api.parts).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ stale: false, refreshing: false, session: { currentPartId: 2 } })
})
it('coalesces cable and command acknowledgement when final verification starts after both', async () => {
  const controller = await setup(), pending = defer<LiveSession>()
  api.session.mockReturnValueOnce(pending.promise).mockResolvedValue(next())
  event(); controller.refreshAfterCommand(); pending.resolve(next()); await flush()
  expect(api.session).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot().session?.currentPartId).toBe(2)
  expect(controller.getSnapshot().refreshing).toBe(false)
})
it('rechecks notifications arriving during final verification instead of accepting a possibly stale response', async () => {
  const controller = await setup(), pending = defer<LiveSession>()
  api.session.mockResolvedValueOnce(next()).mockReturnValueOnce(pending.promise).mockResolvedValue(next(3))
  event(); await flush()
  event(); pending.resolve(next()); await flush()
  expect(api.session).toHaveBeenCalledTimes(4)
  expect(currentPart(controller.getSnapshot().session!, parts)?.key).toBe('lp:21')
})
it('retries a changed before/after snapshot and never publishes the intermediate occurrence', async () => {
  const controller = await setup(), seen: number[] = []
  controller.subscribe(() => { if (!controller.getSnapshot().stale) seen.push(controller.getSnapshot().session!.currentPartId!) })
  api.session.mockResolvedValueOnce(next()).mockResolvedValue(next(3))
  event(); await flush()
  expect(api.session).toHaveBeenCalledTimes(4)
  expect(seen).not.toContain(2)
  expect(currentPart(controller.getSnapshot().session!, parts)?.key).toBe('lp:21')
})
it.each(['status_change', 'explanation_updated'])('does not absorb a %s invalidation into an earlier recovery', async kind => {
  const controller = await setup(), pending = defer<LiveSession>()
  api.session.mockReturnValueOnce(pending.promise)
  event(); event(kind); pending.resolve(session); await flush()
  expect(api.session).toHaveBeenCalledTimes(4)
  expect(api.parts).toHaveBeenCalledTimes(1)
  expect(api.services).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().stale).toBe(false)
})
it.each([
  { ...raw, liturgies: [{ id: 20, position: 1 }, { id: 10, position: 2 }] },
  { ...raw, readings: { gospel: 'edited' } },
  { ...raw, num_of_parts: 5 },
  { ...raw, liturgies: undefined },
])('fetches content again when the session context changes or becomes incomplete: %j', async changed => {
  const controller = await setup()
  api.session.mockResolvedValue(normalizeSession({ session: changed }))
  event(); await flush()
  expect(api.parts).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().stale).toBe(false)
})
it('fetches a missing occurrence even while the cached manifest is fresh', async () => {
  const controller = await setup()
  api.session.mockResolvedValue(normalizeSession({ session: { ...raw, current_part_id: 99 } }))
  api.parts.mockResolvedValue(normalizeParts({ parts: [{ part: { id: 99, liturgy_id: 10, liturgy_part_id: 99, position: 1 } }] }))
  event(); await flush()
  expect(api.parts).toHaveBeenCalledTimes(1)
  const state = controller.getSnapshot()
  expect(currentPart(state.session!, state.parts)?.key).toBe('lp:99')
})
it('polls full content and discovery, even when movement continues to reuse the text', async () => {
  const controller = await setup()
  for (let i = 0; i < 2; i++) { await jest.advanceTimersByTimeAsync(10000); event(); await flush() }
  expect(api.parts).not.toHaveBeenCalled()
  api.services.mockResolvedValue([])
  api.parts.mockResolvedValue(parts.map(part => ({ ...part, text: { ...part.text, en: 'edited content' } })))
  await jest.advanceTimersByTimeAsync(10000); await flush()
  expect(api.parts).toHaveBeenCalledTimes(1); expect(api.services).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().listed).toBe(false)
  expect(controller.getSnapshot().parts[0].text.en).toBe('edited content')
})
it('manual refresh and reconnect always reload content', async () => {
  const controller = await setup()
  controller.retry(); await flush()
  callbacks.connected(); await flush()
  expect(api.parts).toHaveBeenCalledTimes(2); expect(api.services).toHaveBeenCalledTimes(2)
})
it('keeps prior readings on a failed fast recovery and retains manual reading mode', async () => {
  const controller = await setup()
  controller.dispatch({ type: 'manual' })
  api.session.mockRejectedValueOnce(new Error('offline'))
  event(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ parts, stale: true, following: false })
  controller.refreshAfterCommand(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ error: null, stale: false, following: false })
})
it('does not publish a late fast recovery after disposal', async () => {
  const controller = await setup(), pending = defer<LiveSession>()
  api.session.mockReturnValueOnce(pending.promise)
  event(); stop(); pending.resolve(next()); await flush()
  expect(controller.getSnapshot().session).toEqual(session)
  expect(jest.getTimerCount()).toBe(0)
})
it('starts explanations only after accepting the reading, including coalesced notifications', async () => {
  const controller = await setup(), pending = defer<LiveSession>()
  api.session.mockReturnValueOnce(pending.promise).mockResolvedValue(next())
  api.explanations.mockResolvedValue([{ id: 2, title: 'new', description: null, liturgyPartId: 12 }])
  event(); controller.refreshAfterCommand(); await flush()
  expect(api.explanations).not.toHaveBeenCalled()
  pending.resolve(next()); await flush()
  expect(api.explanations).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().explanations.map(e => e.id)).toEqual([2])
})
