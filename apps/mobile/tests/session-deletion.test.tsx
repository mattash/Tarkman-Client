import { expect, it, jest } from '@jest/globals'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { createDeletionController } from '../features/services/management/deletion'
import { forgetRecentlyControlled, readRecentlyControlled, recentlyControlledKey } from '../features/progress/recentlyControlled'
import { deferred, memoryStore, respond } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const snapshot = (revision = 17) => respond(200, { schema_version: 1, session: fixtures.managedSession({ revision }) })
/** The documented success: HTTP 200 with an empty body. Parsing it would throw. */
const emptyOk = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input') }, headers: { get: () => null } } as unknown as Response)
type Fetch = AuthContextValue['authorizedFetch']
function setup(...responses: Array<Response | Promise<Response> | Error>) {
  const fetcher = jest.fn<Fetch>()
  for (const response of responses) {
    if (response instanceof Error) fetcher.mockRejectedValueOnce(response)
    else fetcher.mockReturnValueOnce(Promise.resolve(response))
  }
  return { fetcher, controller: createDeletionController(fetcher) }
}
const deletes = (fetcher: jest.Mock<Fetch>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')

it('confirms against a fresh snapshot and accepts an empty 200 without parsing it', async () => {
  const { fetcher, controller } = setup(snapshot(), emptyOk())
  controller.prepare(4008); await flush()
  expect(controller.getSnapshot()).toMatchObject({ phase: 'confirming', target: { id: 4008, revision: 17 } })
  expect(deletes(fetcher)).toHaveLength(0)
  controller.confirm(); controller.confirm(); await flush()
  expect(deletes(fetcher)).toHaveLength(1)
  expect(deletes(fetcher)[0][0]).toBe('/s/4008.json')
  expect(JSON.parse(String(deletes(fetcher)[0][1]?.body))).toEqual({ expected_revision: 17 })
  expect(controller.getSnapshot().phase).toBe('deleted')
})

it('sends nothing when cancelled', async () => {
  const { fetcher, controller } = setup(snapshot())
  controller.prepare(4008); await flush()
  controller.cancel()
  controller.confirm(); await flush()
  expect(deletes(fetcher)).toHaveLength(0)
  expect(controller.getSnapshot().phase).toBe('idle')
})

it('refreshes after a stale revision and requires a new confirmation', async () => {
  const { fetcher, controller } = setup(snapshot(17), respond(409, { code: 'stale_session' }), snapshot(18), emptyOk())
  controller.prepare(4008); await flush()
  controller.confirm(); await flush(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ phase: 'confirming', renewed: true, target: { revision: 18 } })
  expect(deletes(fetcher)).toHaveLength(1)
  controller.confirm(); await flush()
  expect(JSON.parse(String(deletes(fetcher)[1][1]?.body))).toEqual({ expected_revision: 18 })
})

it('reports a typed 404 as already unavailable, not as this request deleting it', async () => {
  const { controller } = setup(snapshot(), respond(404, fixtures.sessionNotFound))
  controller.prepare(4008); await flush()
  controller.confirm(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ phase: 'gone', error: 'Session is already unavailable.' })
})

it.each<[string, () => Response | Error, string]>([
  ['still exists', () => snapshot(17), 'confirming'],
  ['is gone', () => respond(404, fixtures.sessionNotFound), 'gone'],
  ['cannot be read', () => new TypeError('offline'), 'unknown'],
])('reconciles an unknown DELETE outcome when the session %s', async (_, read, phase) => {
  const { fetcher, controller } = setup(snapshot(), respond(503), read())
  controller.prepare(4008); await flush()
  controller.confirm(); await flush(); await flush()
  expect(controller.getSnapshot().phase).toBe(phase)
  expect(deletes(fetcher)).toHaveLength(1)
})

it('ignores a late snapshot after cancel', async () => {
  const pending = deferred<Response>()
  const { controller } = setup(pending.promise as unknown as Response)
  controller.prepare(4008)
  controller.cancel()
  pending.resolve(snapshot()); await flush()
  expect(controller.getSnapshot().phase).toBe('idle')
})

it('forgets only the deleted session shortcut for this account', async () => {
  const { store } = memoryStore()
  const entries = [4008, 12].map(sessionId => ({ sessionId, title: `S${sessionId}`, church: 'C', date: null, controlledAt: 1 }))
  await store.set(recentlyControlledKey(3), JSON.stringify(entries))
  await store.set(recentlyControlledKey(4), JSON.stringify(entries))
  await forgetRecentlyControlled(4008, 3, store)
  expect(readRecentlyControlled(await store.get(recentlyControlledKey(3))).map(item => item.sessionId)).toEqual([12])
  expect(readRecentlyControlled(await store.get(recentlyControlledKey(4))).map(item => item.sessionId)).toEqual([4008, 12])
})
