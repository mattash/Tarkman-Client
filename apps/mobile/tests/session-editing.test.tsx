import { expect, it, jest } from '@jest/globals'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { createEditController, isEditDirty, pendingChanges } from '../features/services/management/editing'
import { moveLiturgy, removeLiturgy } from '../features/services/management/draft'
import { deferred, respond } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const snapshot = (overrides: Record<string, unknown> = {}) => ({ schema_version: 1, session: fixtures.managedSession(overrides) })
const unavailableLiturgy = fixtures.managedSession({ liturgy_ids: [101, 909], liturgies: [
  { id: 101, name: 'Divine Liturgy', position: 1, selectable: true }, { id: 909, name: 'Archived Vespers', position: 2, selectable: false }] })
type Fetch = AuthContextValue['authorizedFetch']
function setup(...responses: Array<Response | Promise<Response> | Error>) {
  const fetcher = jest.fn<Fetch>()
  for (const response of responses) {
    if (response instanceof Error) fetcher.mockRejectedValueOnce(response)
    else fetcher.mockReturnValueOnce(Promise.resolve(response))
  }
  return { fetcher, controller: createEditController(fetcher, 4008) }
}
const writes = (fetcher: jest.Mock<Fetch>) => fetcher.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')
const body = (fetcher: jest.Mock<Fetch>, index = 0) => JSON.parse(String(writes(fetcher)[index][1]?.body))

it('loads the complete saved baseline, including unavailable selections, without writing', async () => {
  const { fetcher, controller } = setup(respond(200, { schema_version: 1, session: unavailableLiturgy }))
  await controller.load()
  expect(fetcher.mock.calls[0][0]).toBe('/s/4008/edit.json')
  expect(controller.getSnapshot().draft.liturgies.map(item => [item.id, item.selectable])).toEqual([[101, true], [909, false]])
  expect(isEditDirty(controller.getSnapshot())).toBe(false)
  expect(writes(fetcher)).toHaveLength(0)
})

it('never overwrites a dirty draft when it refetches on focus', async () => {
  const { controller } = setup(respond(200, snapshot()), respond(200, snapshot({ revision: 18, options: { gospel: 'Server' } })))
  await controller.load()
  controller.setOption('epistle', 'Mine')
  await controller.load()
  expect(controller.getSnapshot().draft.options).toMatchObject({ epistle: 'Mine', gospel: 'John 1:1-17' })
  expect(controller.getSnapshot().baseline?.revision).toBe(17)
})

it('sends only deliberate changes, key-wise, with the baseline revision (zero included)', async () => {
  const { fetcher, controller } = setup(respond(200, snapshot({ revision: 0 })), respond(200, { session: fixtures.managedSession({ revision: 1, date: '2026-10-11' }) }))
  await controller.load()
  controller.setDate('2026-10-11')
  controller.setOption('before_message', '')
  expect(pendingChanges(controller.getSnapshot())).toEqual({ date: '2026-10-11', options: { before_message: '' } })
  controller.save(); controller.save()
  await flush()
  expect(writes(fetcher)).toHaveLength(1)
  expect(fetcher.mock.calls[1][0]).toBe('/s/4008.json')
  expect(writes(fetcher)[0][1]?.method).toBe('PATCH')
  expect(body(fetcher)).toEqual({ expected_revision: 0, session: { date: '2026-10-11', options: { before_message: '' } } })
  expect(controller.getSnapshot()).toMatchObject({ phase: 'saved', baseline: { revision: 1 } })
})

it('sends the ordered ids only when membership or order changed, keeping unavailable ones', async () => {
  const { fetcher, controller } = setup(respond(200, { schema_version: 1, session: unavailableLiturgy }), respond(200, { session: unavailableLiturgy }))
  await controller.load()
  controller.update(draft => moveLiturgy(draft, 909, -1))
  controller.save(); await flush()
  expect(body(fetcher)).toEqual({ expected_revision: 17, session: { liturgy_ids: [909, 101] } })
})

it('keeps the draft on a stale save; reload discards it, reapply rebases it for another deliberate save', async () => {
  const fresh = fixtures.managedSession({ revision: 19, options: { gospel: 'Theirs', epistle: 'Romans 8', before_message: 'Welcome.', after_message: '' } })
  const { fetcher, controller } = setup(respond(200, snapshot()), respond(409, { code: 'stale_session', error: 'stale_session', session: fresh }),
    respond(200, { session: fixtures.managedSession({ revision: 20 }) }))
  await controller.load()
  controller.setOption('after_message', 'Go in peace.')
  controller.save(); await flush()
  let state = controller.getSnapshot()
  expect(state).toMatchObject({ phase: 'editing', errorKind: 'stale', conflict: { revision: 19 } })
  expect(state.draft.options.after_message).toBe('Go in peace.')
  // Locked for review: no silent resend.
  controller.save(); await flush()
  expect(writes(fetcher)).toHaveLength(1)
  controller.reapply()
  state = controller.getSnapshot()
  expect(state.baseline?.revision).toBe(19)
  expect(state.draft.options).toEqual({ gospel: 'Theirs', epistle: 'Romans 8', before_message: 'Welcome.', after_message: 'Go in peace.' })
  controller.save(); await flush()
  expect(body(fetcher, 1)).toEqual({ expected_revision: 19, session: { options: { after_message: 'Go in peace.' } } })
})

it('reload saved version discards local changes', async () => {
  const fresh = fixtures.managedSession({ revision: 19, date: '2026-12-25' })
  const { controller } = setup(respond(200, snapshot()), respond(409, { code: 'stale_session', session: fresh }))
  await controller.load()
  controller.setOption('gospel', 'Mine')
  controller.save(); await flush()
  controller.reloadSaved()
  expect(controller.getSnapshot()).toMatchObject({ conflict: null, draft: { date: '2026-12-25', options: { gospel: 'John 1:1-17' } } })
  expect(isEditDirty(controller.getSnapshot())).toBe(false)
})

it('asks before resetting the current part and confirms only at the reviewed revision', async () => {
  const reset = { code: 'cursor_reset_required', revision: 18, proposed_cursor: { liturgy_name: 'Morning Service', role: 'priest', position: 1 } }
  const { fetcher, controller } = setup(respond(200, snapshot()), respond(409, reset), respond(409, reset))
  await controller.load()
  controller.update(draft => removeLiturgy(draft, 101))
  controller.save(); await flush()
  expect(controller.getSnapshot().reset).toEqual({ revision: 18, destination: 'Morning Service · priest · #1' })
  expect(body(fetcher)).not.toHaveProperty('confirm_cursor_reset')
  controller.cancelReset()
  expect(controller.getSnapshot().reset).toBeNull()
  expect(writes(fetcher)).toHaveLength(1)
  controller.save(); await flush()
  fetcher.mockReturnValueOnce(Promise.resolve(respond(200, { session: fixtures.managedSession({ revision: 19 }) })))
  controller.confirmReset(); controller.confirmReset(); await flush()
  expect(writes(fetcher)).toHaveLength(3)
  expect(body(fetcher, 2)).toEqual({ expected_revision: 18, confirm_cursor_reset: true, session: { liturgy_ids: [202] } })
})

it('reconciles an unknown save outcome from the saved snapshot instead of resending', async () => {
  const landed = setup(respond(200, snapshot()), new TypeError('Network request failed'), respond(200, snapshot({ revision: 18, date: '2026-10-11' })))
  await landed.controller.load()
  landed.controller.setDate('2026-10-11')
  landed.controller.save(); await flush(); await flush()
  expect(landed.controller.getSnapshot()).toMatchObject({ phase: 'saved', baseline: { revision: 18 } })
  expect(writes(landed.fetcher)).toHaveLength(1)

  const missed = setup(respond(200, snapshot()), respond(502), respond(200, snapshot({ revision: 17 })))
  await missed.controller.load()
  missed.controller.setDate('2026-10-11')
  missed.controller.save(); await flush(); await flush()
  expect(missed.controller.getSnapshot()).toMatchObject({ phase: 'editing', conflict: { revision: 17 }, conflictReason: 'unconfirmed', draft: { date: '2026-10-11' } })
  expect(writes(missed.fetcher)).toHaveLength(1)
})

it.each([[403, {}, 'forbidden'], [404, fixtures.sessionNotFound, 'notFound']])('stops editing after %s', async (status, response, kind) => {
  const { controller } = setup(respond(200, snapshot()), respond(status, response))
  await controller.load()
  controller.setDate('2026-10-11')
  controller.save(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ final: true, errorKind: kind })
})

it('shows loading and a retryable error without editable defaults', async () => {
  const pending = deferred<Response>()
  const { controller } = setup(pending.promise as unknown as Response)
  void controller.load()
  expect(controller.getSnapshot()).toMatchObject({ loading: true, baseline: null })
  controller.setDate('2026-01-01')
  expect(controller.getSnapshot().draft.date).toBe('')
  pending.resolve(respond(503)); await flush()
  expect(controller.getSnapshot()).toMatchObject({ baseline: null, final: false, loadError: expect.any(String) })
})

it('a focus reload cannot cancel the check after an unknown save', async () => {
  const check = deferred<Response>()
  const { fetcher, controller } = setup(respond(200, snapshot()), new TypeError('Network request failed'), check.promise as unknown as Response)
  await controller.load()
  controller.setDate('2026-10-11')
  controller.save(); await flush()
  void controller.load()
  check.resolve(respond(200, snapshot({ revision: 18, date: '2026-10-11' }))); await flush(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ phase: 'saved' })
  expect(fetcher.mock.calls.filter(([path]) => path === '/s/4008/edit.json')).toHaveLength(2)
})
