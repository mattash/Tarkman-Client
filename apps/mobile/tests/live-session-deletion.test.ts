import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createApi, type ReaderApi } from '../features/live/api'
import type { CableCallbacks } from '../features/live/cable'
import { normalizeParts, normalizeSession, normalizeState, parseEvent, type SessionState } from '../features/live/contracts'
import { createReaderController } from '../features/live/controller'
import { initialState, readerReducer } from '../features/live/state'
import { respond } from './auth-helpers'

const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }
const session = normalizeSession({ session: { id: 7, current_part_id: 1, current_liturgy_id: 10, current_part_position: 1, num_of_parts: 1 } })
const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_id: 10, liturgy_part_id: 11, position: 1, en: 'first' } }] })
const state = (revision: number): SessionState => normalizeState({ session: { id: 7, revision, content_context: 'c', session_status: 'active', status_message: null,
  posture: 'stand', date: '2026-09-17', cursor: { part_id: 1, liturgy_part_id: 11, liturgy_id: 10, position: 1 } } })
const notFound = () => Object.assign(new Error('gone'), { name: 'SessionNotFound' })

let api: jest.Mocked<ReaderApi> & { state: jest.Mock<(id: number, signal: AbortSignal) => Promise<SessionState | null>> }
let callbacks: CableCallbacks, stop: () => void, unsubscribed: number
beforeEach(() => {
  jest.useFakeTimers()
  unsubscribed = 0
  api = { state: jest.fn<(id: number, signal: AbortSignal) => Promise<SessionState | null>>().mockResolvedValue(state(17)),
    services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
})
afterEach(() => { stop?.(); jest.useRealTimers() })
async function setup() {
  const controller = createReaderController(api, { subscribe: (_url, _id, cb) => { callbacks = cb; return () => { unsubscribed++ } } },
    'wss://example.test', { listen: () => () => {} }, 7)
  stop = controller.start(); await flush(); callbacks.connected(); await flush()
  for (const mock of Object.values(api)) mock.mockClear()
  return controller
}
const deleted = (revision: number, sessionId = 7) => callbacks.received({ event: 'session_deleted', data: { session_id: sessionId, revision } })

it('parses only a well-formed terminal event', () => {
  expect(parseEvent({ event: 'session_deleted', data: { session_id: 4008, revision: 18 } })).toEqual({ event: 'session_deleted', sessionId: 4008, revision: 18 })
  for (const data of [{ session_id: 'x', revision: 1 }, { session_id: 1 }, { session_id: 1, revision: 1.5 }, null]) {
    expect(parseEvent({ event: 'session_deleted', data })).toBeNull()
  }
})

it('stops everything on a terminal event beyond the accepted revision, and nothing revives it', async () => {
  const controller = await setup()
  expect(controller.getSnapshot().session?.revision).toBe(17)
  deleted(18)
  expect(controller.getSnapshot()).toMatchObject({ deleted: true, session: null, error: 'This service is no longer available.' })
  expect(unsubscribed).toBe(1)
  // Late socket messages, polls, retries and command refreshes are all inert.
  callbacks.received({ event: 'part_change', data: { session: 7, revision: 19, content_context: 'c', session_status: 'active', cursor: { part_id: 1, liturgy_part_id: 11, liturgy_id: 10, position: 1 } } })
  controller.retry()
  controller.refreshAfterCommand(state(20))
  jest.advanceTimersByTime(120000); await flush()
  for (const mock of Object.values(api)) expect(mock).not.toHaveBeenCalled()
  expect(controller.getSnapshot()).toMatchObject({ deleted: true, session: null })
})

it('ignores a deletion event for another session and re-reads for a stale revision', async () => {
  const controller = await setup()
  deleted(18, 99)
  expect(controller.getSnapshot().deleted).toBe(false)
  deleted(17)
  expect(controller.getSnapshot().deleted).toBe(false)
  await flush()
  expect(api.state).toHaveBeenCalled()
})

it('treats a typed missing-session read as deletion when the event was missed', async () => {
  const controller = await setup()
  api.state.mockRejectedValueOnce(notFound())
  controller.retry(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ deleted: true })
})

it('does not treat a generic failure as deletion', async () => {
  const controller = await setup()
  api.state.mockRejectedValueOnce(new Error('offline'))
  controller.retry(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ deleted: false, error: expect.any(String) })
})

it('keeps the terminal state against late recoveries in the reducer', () => {
  const gone = readerReducer(initialState, { type: 'deleted', message: 'gone' })
  const late = readerReducer(gone, { type: 'recovered', now: 1, snapshot: { services: [], session, parts, explanations: [], explanationError: false, listed: true } })
  expect(late).toBe(gone)
})

it('distinguishes the typed 404 marker from a generic route 404', async () => {
  const typed = createApi('https://api.test', jest.fn<typeof fetch>().mockResolvedValue(respond(404, { error: 'session_not_found', code: 'session_not_found' })))
  await expect(typed.session(7, new AbortController().signal)).rejects.toMatchObject({ name: 'SessionNotFound' })
  await expect(typed.state!(7, new AbortController().signal)).rejects.toMatchObject({ name: 'SessionNotFound' })
  const generic = createApi('https://api.test', jest.fn<typeof fetch>().mockResolvedValue(respond(404, { error: 'Not found' })))
  await expect(generic.session(7, new AbortController().signal)).rejects.not.toMatchObject({ name: 'SessionNotFound' })
  await expect(generic.state!(7, new AbortController().signal)).resolves.toBeNull()
})
