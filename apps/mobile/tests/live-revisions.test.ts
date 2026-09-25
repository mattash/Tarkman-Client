import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { recoveryContext } from '../features/observability/latencyBenchmark'
import { createReaderController } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableCallbacks } from '../features/live/cable'
import { currentPart, normalizeParts, normalizeSession, normalizeState, type SessionState } from '../features/live/contracts'

const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }
const session = normalizeSession({ session: { id: 7, current_part_id: 1, current_liturgy_id: 10,
  current_part_position: 1, num_of_parts: 3, liturgies: [{ id: 10 }, { id: 20 }] } })
const parts = normalizeParts({ parts: [
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 11, position: 1, en: 'first' } },
  { part: { id: 1, liturgy_id: 20, liturgy_part_id: 21, position: 2, en: 'repeated' } },
  { part: { id: 2, liturgy_id: 20, liturgy_part_id: 22, position: 3, en: 'next' } },
] })
function payload(revision = 0, index = 0, extra: Record<string, unknown> = {}) {
  const part = parts[index]
  return { revision, content_context: 'original', session_status: 'active', status_message: null, posture: 'stand', date: '2026-09-17',
    // Backend position is deduplicated and deliberately differs from the manifest position.
    cursor: { part_id: part.id, liturgy_part_id: part.liturgyPartId, liturgy_id: part.liturgyId, position: index === 2 ? 2 : 1 }, ...extra }
}
function compact(revision = 0, index = 0, extra: Record<string, unknown> = {}): SessionState {
  return normalizeState({ session: { id: 7, ...payload(revision, index, extra) } })
}
function defer<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
let api: jest.Mocked<ReaderApi> & { state: jest.Mock<(id: number, signal: AbortSignal) => Promise<SessionState | null>> }
let callbacks: CableCallbacks, stop: () => void
beforeEach(() => {
  jest.useFakeTimers()
  api = { state: jest.fn<(id: number, signal: AbortSignal) => Promise<SessionState | null>>().mockResolvedValue(compact()),
    services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
})
afterEach(() => { stop?.(); jest.useRealTimers() })
async function setup(loadExplanations = false) {
  const controller = createReaderController(api, { subscribe: (_url, _id, cb) => { callbacks = cb; return () => {} } },
    'wss://example.test', { listen: () => () => {} }, 7, undefined, loadExplanations)
  stop = controller.start(); await flush(); callbacks.connected(); await flush()
  for (const mock of Object.values(api)) mock.mockClear()
  return controller
}
function event(revision = 1, index = 2, extra: Record<string, unknown> = {}, kind = 'part_change') {
  callbacks.received({ event: kind, data: { session: 7, session_id: 7, ...payload(revision, index, extra) } })
}
it('applies the confirmed occurrence immediately without any GET, even when cursor position differs from the manifest', async () => {
  const controller = await setup()
  event()
  const state = controller.getSnapshot()
  expect(state).toMatchObject({ stale: false, refreshing: false, session: { revision: 1, currentLiturgyPartId: 22, currentPosition: 2 } })
  expect(currentPart(state.session!, state.parts)?.key).toBe('lp:22')
  for (const mock of Object.values(api)) expect(mock).not.toHaveBeenCalled()
})
it('resolves repeated part identity by occurrence rather than part ID or position', async () => {
  const controller = await setup()
  event(1, 1)
  expect(currentPart(controller.getSnapshot().session!, parts)?.key).toBe('lp:21')
})
it.each(['part_change', 'status_change'])('applies all committed state fields from %s', async kind => {
  const controller = await setup()
  event(1, 0, { session_status: 'showing_custom', status_message: 'Welcome', posture: 'sit', date: '2026-09-18' }, kind)
  expect(controller.getSnapshot().session).toMatchObject({ revision: 1, status: 'showing_custom', message: 'Welcome', posture: 'sit', date: '2026-09-18' })
  expect(api.state).not.toHaveBeenCalled()
})
it.each(['ack-first', 'cable-first'])('accepts a command and its duplicate socket event once (%s)', async order => {
  const controller = await setup(), changed = jest.fn()
  controller.subscribe(changed)
  if (order === 'ack-first') { controller.refreshAfterCommand(compact(1, 2)); event() }
  else { event(); controller.refreshAfterCommand(compact(1, 2)) }
  event(0)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().session?.revision).toBe(1)
  expect(api.state).not.toHaveBeenCalled()
})
it('recovers a gap with one small state read and keeps the cached manifest', async () => {
  const controller = await setup()
  api.state.mockResolvedValue(compact(4, 2))
  event(4); await flush()
  expect(api.state).toHaveBeenCalledTimes(1)
  expect(api.parts).not.toHaveBeenCalled(); expect(api.session).not.toHaveBeenCalled(); expect(api.services).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { revision: 4 } })
})
it('reloads changed text even when the content edit did not consume a navigation revision', async () => {
  const controller = await setup()
  api.state.mockResolvedValue(compact(0, 0, { content_context: 'edited' }))
  api.parts.mockResolvedValue(parts.map(part => ({ ...part, text: { ...part.text, en: 'edited text' } })))
  event(0, 0, { content_context: 'edited' }); await flush()
  expect(api.state).toHaveBeenCalledTimes(2); expect(api.parts).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().parts[0].text.en).toBe('edited text')
})
it('recovers an unknown occurrence instead of selecting a similar part or indexing position', async () => {
  const controller = await setup()
  api.state.mockResolvedValue(compact(1, 2))
  event(1, 2, { cursor: { part_id: 2, liturgy_part_id: 999, liturgy_id: 20, position: 2 } }); await flush()
  expect(api.state).toHaveBeenCalledTimes(1)
  expect(currentPart(controller.getSnapshot().session!, parts)?.key).toBe('lp:22')
})
it('rejects a canonical cursor that is still absent after reloading the manifest', async () => {
  const controller = await setup()
  const cursor = { part_id: 2, liturgy_part_id: 999, liturgy_id: 20, position: 2 }
  api.state.mockResolvedValue(compact(1, 2, { cursor }))
  event(1, 2, { cursor }); await flush()
  expect(api.parts).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot()).toMatchObject({ stale: true, session: { revision: 0 } })
})
it('recovers a legacy or incomplete event through state without loading full content', async () => {
  const controller = await setup()
  api.state.mockResolvedValue(compact(1, 2))
  callbacks.received({ event: 'part_change', data: { session: 7, part: 2 } }); await flush()
  expect(api.state).toHaveBeenCalledTimes(1); expect(api.parts).not.toHaveBeenCalled(); expect(api.session).not.toHaveBeenCalled()
  expect(controller.getSnapshot().session?.revision).toBe(1)
})
it('does not regress when a newer event arrives while a recovery state read is in flight', async () => {
  const controller = await setup(), pending = defer<SessionState>()
  api.state.mockReturnValueOnce(pending.promise).mockResolvedValue(compact(3, 2))
  callbacks.received({ event: 'part_change', data: { session: 7 } })
  await flush(); event(3); pending.resolve(compact(1, 1)); await flush()
  expect(api.state).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { revision: 3, currentLiturgyPartId: 22 } })
})
it('brackets bootstrap content and discards text fetched across a content-token change', async () => {
  api.state.mockResolvedValueOnce(compact()).mockResolvedValue(compact(0, 0, { content_context: 'new' }))
  api.parts.mockResolvedValueOnce(parts).mockResolvedValue(parts.map(part => ({ ...part, text: { ...part.text, en: 'new' } })))
  const controller = await setup()
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { contentContext: 'new' } })
  expect(controller.getSnapshot().parts[0].text.en).toBe('new')
})
it('accepts cursor movement during bootstrap when content is stable', async () => {
  api.state.mockResolvedValueOnce(compact()).mockResolvedValue(compact(1, 2))
  const controller = await setup()
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { revision: 1, currentLiturgyPartId: 22 } })
})
it('uses lightweight recovery after reconnect and preserves manual reading mode', async () => {
  const controller = await setup()
  controller.dispatch({ type: 'manual' })
  api.state.mockResolvedValue(compact(5, 2))
  callbacks.disconnected(); await flush(); callbacks.connected(); await flush()
  expect(api.state).toHaveBeenCalledTimes(2); expect(api.parts).not.toHaveBeenCalled(); expect(api.session).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ following: false, stale: false, session: { revision: 5 } })
})
it('polls state and discovery to catch missed content edits, without refetching an unchanged manifest', async () => {
  const controller = await setup()
  await jest.advanceTimersByTimeAsync(30000); await flush()
  expect(api.state).toHaveBeenCalledTimes(2); expect(api.services).toHaveBeenCalledTimes(1); expect(api.parts).not.toHaveBeenCalled()
  expect(controller.getSnapshot().stale).toBe(false)
})
it('does not accept late state after disposal', async () => {
  const controller = await setup(), pending = defer<SessionState>()
  api.state.mockReturnValueOnce(pending.promise)
  callbacks.received({ event: 'part_change', data: { session: 7 } })
  stop(); pending.resolve(compact(1, 2)); await flush()
  expect(controller.getSnapshot().session?.revision).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it('keeps the legacy read path when the state endpoint is not deployed', async () => {
  api.state.mockResolvedValue(null)
  const controller = await setup()
  callbacks.received({ event: 'part_change', data: { session: 7 } }); await flush()
  expect(api.session).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { currentPartId: 1 } })
})
it('does not block a reading on the explanations request', async () => {
  const controller = await setup(true), pending = defer<never>()
  api.explanations.mockReturnValue(pending.promise)
  event()
  expect(controller.getSnapshot()).toMatchObject({ stale: false, explanationsLoading: true, session: { revision: 1 } })
  expect(api.state).not.toHaveBeenCalled()
})
it('accepts a null cursor as authoritative empty current state', async () => {
  const controller = await setup()
  event(1, 0, { cursor: null })
  expect(controller.getSnapshot().session).toMatchObject({ revision: 1, currentPartId: null, currentLiturgyPartId: null })
})
it('does not regress or retry indefinitely if authoritative state is below an observed revision', async () => {
  const controller = await setup()
  event(4); await flush()
  expect(api.state).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot()).toMatchObject({ stale: true, session: { revision: 0 } })
})
it('refreshes only explanations for a dedicated explanation update', async () => {
  await setup(true)
  callbacks.received({ event: 'explanation_updated', data: { session_id: 7 } }); await flush()
  expect(api.explanations).toHaveBeenCalledTimes(1)
  expect(api.state).not.toHaveBeenCalled(); expect(api.parts).not.toHaveBeenCalled(); expect(api.session).not.toHaveBeenCalled()
})
it('accepts a null published date without falling back to a read', async () => {
  const controller = await setup()
  event(1, 2, { date: null })
  expect(controller.getSnapshot().session?.date).toBeNull()
  expect(api.state).not.toHaveBeenCalled()
})
it('keeps direct-publication explanations correlated with the command that requested them', async () => {
  const previous = process.env.EXPO_PUBLIC_LATENCY_BENCHMARK
  process.env.EXPO_PUBLIC_LATENCY_BENCHMARK = 'true'
  globalThis.__TARKMAN_BENCHMARK__ = { run: 'run_1', client: 'reader', sessionId: 7, command: 'command_1', emit: jest.fn() }
  try {
    await setup(true)
    event()
    const signal = api.explanations.mock.calls[0][1]
    globalThis.__TARKMAN_BENCHMARK__.command = 'command_2'
    expect(recoveryContext(signal)).toMatchObject({ command: 'command_1' })
  } finally {
    process.env.EXPO_PUBLIC_LATENCY_BENCHMARK = previous
    delete globalThis.__TARKMAN_BENCHMARK__
  }
})

it('refreshes session reading metadata together with variable gospel text when content changes', async () => {
  const controller = await setup()
  const edited = normalizeSession({ session: { id: 7, current_part_id: 1, current_liturgy_id: 10,
    num_of_parts: 3, liturgies: [{ id: 10 }, { id: 20 }], readings: { gospel: 'Edited gospel' } } })
  api.state.mockResolvedValue(compact(1, 0, { content_context: 'edited', session_status: 'showing_gospel' }))
  api.session.mockResolvedValue(edited)
  api.parts.mockResolvedValue(parts.map(part => ({ ...part, text: { ...part.text, en: 'Edited gospel' } })))
  event(1, 0, { content_context: 'edited', session_status: 'showing_gospel' }, 'status_change'); await flush()
  expect(api.session).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot()).toMatchObject({ stale: false,
    session: { status: 'showing_gospel', contentContext: 'edited', partsContext: edited.partsContext } })
  expect(controller.getSnapshot().parts[0].text.en).toBe('Edited gospel')
})
it('does not pair newer periodic metadata with old content when text changes during the metadata request', async () => {
  const controller = await setup(), pending = defer<typeof session>()
  api.state.mockResolvedValueOnce(compact()).mockResolvedValue(compact(1, 0, { content_context: 'edited' }))
  api.session.mockReturnValueOnce(pending.promise).mockResolvedValue(session)
  api.parts.mockResolvedValue(parts.map(part => ({ ...part, text: { ...part.text, en: 'Edited gospel' } })))
  await jest.advanceTimersByTimeAsync(30000); await flush()
  expect(api.parts).not.toHaveBeenCalled()
  const seen: (string | null | undefined)[] = []
  controller.subscribe(() => { if (!controller.getSnapshot().stale) seen.push(controller.getSnapshot().session?.contentContext) })
  pending.resolve(session); await flush()
  expect(seen).not.toContain('original')
  expect(controller.getSnapshot()).toMatchObject({ stale: false, session: { contentContext: 'edited' } })
  expect(controller.getSnapshot().parts[0].text.en).toBe('Edited gospel')
})

it('retains the revisioned cue on benign polls, invalidates explanation events immediately without a manifest read', async () => {
  const item = { id: 1, title: 'A', description: null, liturgyPartId: 11, contentFingerprint: '["A",null]' }
  api.explanations.mockResolvedValue([item])
  const controller = await setup(true), seen: string[] = []
  controller.subscribe(() => seen.push(controller.getSnapshot().explanationProvenance.status))
  controller.retry(); await flush()
  expect(seen.every(status => ['revalidating', 'ready'].includes(status))).toBe(true)
  const pending = defer<typeof item[]>()
  api.explanations.mockReturnValueOnce(pending.promise)
  const reads = api.parts.mock.calls.length
  callbacks.received({ event: 'explanation_updated', data: { session_id: 7, explanation_id: 1 } })
  expect(controller.getSnapshot().explanations).toEqual([])
  expect(seen).toContain('invalid')
  pending.resolve([{ ...item, title: 'Edited', contentFingerprint: '["Edited",null]' }]); await flush()
  expect(controller.getSnapshot().explanationProvenance.status).toBe('ready')
  expect(controller.getSnapshot().explanations[0].title).toBe('Edited')
  expect(api.parts).toHaveBeenCalledTimes(reads)
  api.explanations.mockResolvedValue([])
  callbacks.received({ event: 'explanation_updated', data: { session_id: 7, explanation_id: 1 } }); await flush()
  expect(controller.getSnapshot().explanations).toEqual([])
})
