import { expect, it, jest } from '@jest/globals'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { byUsageThenTitle, createCatalogController, matchesTitle } from '../features/services/management/catalog'
import { createCreationController, isDirty, RETRY_WINDOW_MS } from '../features/services/management/creation'
import { addLiturgy } from '../features/services/management/draft'
import { deferred, respond } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }))

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const liturgy = { id: 101, name: 'Divine Liturgy', selectable: true }
let keys = 0
function setup(handlers: Array<Response | Promise<Response> | Error>, now = () => 1_000) {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>()
  fetcher.mockResolvedValueOnce(respond(200, fixtures.bootstrap))
  for (const handler of handlers) {
    if (handler instanceof Error) fetcher.mockRejectedValueOnce(handler)
    else fetcher.mockReturnValueOnce(Promise.resolve(handler))
  }
  const controller = createCreationController(fetcher, { now, uuid: () => `key-${++keys}` })
  return { fetcher, controller }
}
const posts = (fetcher: jest.Mock<AuthContextValue['authorizedFetch']>) => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')
async function ready(controller: ReturnType<typeof createCreationController>) {
  controller.focus(); await flush()
  controller.update(draft => addLiturgy(draft, liturgy))
}

it('loads defaults without writing, and is clean until the person changes something', async () => {
  const { fetcher, controller } = setup([])
  controller.focus(); await flush()
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/s/new.json'])
  expect(controller.getSnapshot().draft.date).toBe('2026-09-27')
  expect(isDirty(controller.getSnapshot())).toBe(false)
  controller.setOption('gospel', 'John 1:1-17')
  expect(isDirty(controller.getSnapshot())).toBe(true)
})

it('never lets a late bootstrap overwrite a field the person already changed', async () => {
  const late = deferred<Response>()
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(200, fixtures.bootstrap)).mockReturnValueOnce(late.promise)
  let clock = 0
  const controller = createCreationController(fetcher, { now: () => clock })
  controller.focus(); await flush()
  controller.setDate('2026-12-25')
  clock = 60 * 60 * 1000 // foreground after the bootstrap went stale, e.g. across midnight
  controller.focus()
  late.resolve(respond(200, { ...fixtures.bootstrap, defaults: { date: '2026-09-28', options: { gospel: 'Default' } } }))
  await flush()
  const { draft, baseline } = controller.getSnapshot()
  expect(draft.date).toBe('2026-12-25')
  expect(draft.options.gospel).toBe('Default')
  expect(baseline.date).toBe('2026-09-28')
})

it('sends one POST for repeated taps and keeps the same key and payload for a safe retry', async () => {
  const pending = deferred<Response>()
  const { fetcher, controller } = setup([pending.promise as unknown as Response])
  await ready(controller)
  controller.submit(); controller.submit(); controller.submit()
  expect(posts(fetcher)).toHaveLength(1)
  pending.resolve(respond(503))
  await flush()
  expect(controller.getSnapshot().phase).toBe('uncertain')
  const first = JSON.parse(String(posts(fetcher)[0][1]?.body))
  // The draft is locked while the outcome is unknown.
  controller.setOption('gospel', 'changed')
  expect(controller.getSnapshot().draft.options.gospel).toBe('')
  fetcher.mockResolvedValueOnce(respond(200, fixtures.replayed))
  controller.retrySafely(); controller.retrySafely()
  await flush()
  expect(posts(fetcher)).toHaveLength(2)
  expect(JSON.parse(String(posts(fetcher)[1][1]?.body))).toEqual(first)
  expect(controller.getSnapshot()).toMatchObject({ phase: 'created', replayed: true, created: { id: 4008 } })
  expect(isDirty(controller.getSnapshot())).toBe(false)
})

it('never replays an attempt past the 24-hour window', async () => {
  let clock = 0
  const { fetcher, controller } = setup([new TypeError('Network request failed')], () => clock)
  await ready(controller)
  controller.submit(); await flush()
  expect(controller.getSnapshot().phase).toBe('uncertain')
  clock = RETRY_WINDOW_MS
  controller.retrySafely(); await flush()
  expect(controller.getSnapshot().phase).toBe('expired')
  expect(posts(fetcher)).toHaveLength(1)
})

it('keeps input and maps field errors on 422, then uses a fresh key for the corrected request', async () => {
  const { fetcher, controller } = setup([respond(422, fixtures.validation), respond(201, fixtures.created)])
  await ready(controller)
  controller.setOption('gospel', 'x'.repeat(20))
  controller.submit(); await flush()
  const state = controller.getSnapshot()
  expect(state).toMatchObject({ phase: 'editing', errorKind: 'validation', fields: { liturgy_ids: 'Morning Service is no longer available.', gospel: expect.any(String) } })
  expect(state.focusRequest).toBe(1)
  expect(state.draft.options.gospel).toBe('x'.repeat(20))
  controller.setOption('gospel', 'John 1')
  expect(controller.getSnapshot().fields.gospel).toBeUndefined()
  controller.submit(); await flush()
  const [first, second] = posts(fetcher).map(([, init]) => JSON.parse(String(init?.body)).client_request_id)
  expect(first).not.toBe(second)
  expect(controller.getSnapshot().phase).toBe('created')
})

it('refuses to send without a liturgy or with an impossible date', async () => {
  const { fetcher, controller } = setup([])
  controller.focus(); await flush()
  controller.setDate('2026-02-30')
  controller.submit()
  expect(posts(fetcher)).toHaveLength(0)
  expect(controller.getSnapshot().fields).toEqual({ date: expect.any(String), liturgy_ids: expect.any(String) })
})

it.each([[409, fixtures.idempotencyConflict, 'conflict'], [409, fixtures.creationResultUnavailable, 'creationDeleted'], [403, {}, 'forbidden']])(
  'explains a definite %s without retrying', async (status, body, kind) => {
    const { fetcher, controller } = setup([respond(status, body)])
    await ready(controller)
    controller.submit(); await flush()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'editing', errorKind: kind })
    controller.retrySafely(); await flush()
    expect(posts(fetcher)).toHaveLength(1)
  })

it('stops on sign-in expiry and ignores a result that lands after the form closed', async () => {
  const unauthorized = Object.assign(new Error('expired'), { name: 'UnauthorizedError' })
  const { fetcher, controller } = setup([unauthorized])
  await ready(controller)
  controller.submit(); await flush()
  expect(controller.getSnapshot().phase).toBe('editing')
  expect(controller.pendingAttempt()).toBeNull()
  const late = deferred<Response>()
  fetcher.mockReturnValueOnce(late.promise)
  controller.submit()
  controller.dispose()
  late.resolve(respond(201, fixtures.created)); await flush()
  expect(controller.getSnapshot().phase).toBe('pending')
})

it('shows the bootstrap failure on its own, distinguishing unavailable from retryable', async () => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(200, { ...fixtures.bootstrap, session_management_version: 0 }))
    .mockResolvedValueOnce(respond(503)).mockResolvedValueOnce(respond(200, fixtures.bootstrap))
  const controller = createCreationController(fetcher)
  controller.focus(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ unavailable: true, bootstrap: null })
  await controller.retryBootstrap()
  expect(controller.getSnapshot()).toMatchObject({ unavailable: false, bootstrapError: expect.any(String) })
  await controller.retryBootstrap()
  expect(controller.getSnapshot().bootstrap).not.toBeNull()
})

it('loads every catalog page once, so the sheet filter covers the whole catalog', async () => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(200, fixtures.liturgyPage1))
    .mockResolvedValueOnce(respond(200, fixtures.liturgyPage2))
  const catalog = createCatalogController(fetcher)
  catalog.ensureLoaded(); catalog.ensureLoaded(); await flush()
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/s/liturgy_options.json?limit=50', '/s/liturgy_options.json?limit=50&after_id=202'])
  expect(catalog.getSnapshot()).toMatchObject({ complete: true, error: null })
  // Without usage counts, alphabetical.
  expect(catalog.getSnapshot().liturgies.map(item => item.name)).toEqual(['Divine Liturgy', 'Evening Service', 'Morning Service'])
  catalog.ensureLoaded(); await flush()
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('refuses a continuation that does not move forward', async () => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(200, fixtures.liturgyPage1))
    .mockResolvedValue(respond(200, { ...fixtures.liturgyPage2, next_after_id: 202 }))
  const catalog = createCatalogController(fetcher)
  catalog.ensureLoaded(); await flush()
  expect(catalog.getSnapshot()).toMatchObject({ complete: false, error: expect.any(String), liturgies: [] })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('orders by this account\'s usage, most used first, then by title, like the backend form', () => {
  const items = [
    { id: 1, name: 'Vespers', selectable: true, usageCount: 2 }, { id: 2, name: 'Divine Liturgy', selectable: true, usageCount: 9 },
    { id: 3, name: 'Blessing of Water', selectable: true, usageCount: 2 }, { id: 4, name: 'Anthem', selectable: true, usageCount: null },
    { id: 5, name: 'Hour 10', selectable: true, usageCount: 0 }, { id: 6, name: 'Hour 9', selectable: true, usageCount: 0 },
  ]
  expect([...items].sort(byUsageThenTitle).map(item => item.name)).toEqual(['Divine Liturgy', 'Blessing of Water', 'Vespers', 'Anthem', 'Hour 9', 'Hour 10'])
})

it('filters titles locally, ignoring case, accents and word order', () => {
  expect(matchesTitle('Divine Liturgy', 'liturgy div')).toBe(true)
  expect(matchesTitle('Service of the Washing of Feet', 'WASH feet')).toBe(true)
  expect(matchesTitle('Café Vespers', 'cafe')).toBe(true)
  expect(matchesTitle('Morning Service', 'evening')).toBe(false)
  expect(matchesTitle('Morning Service', '   ')).toBe(true)
})

it('reports a catalog failure as retryable, not as an empty catalog', async () => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(500)).mockResolvedValueOnce(respond(200, fixtures.liturgyPage2))
  const catalog = createCatalogController(fetcher)
  catalog.ensureLoaded(); await flush()
  expect(catalog.getSnapshot()).toMatchObject({ error: expect.any(String), complete: false, unavailable: false })
  await catalog.retry()
  expect(catalog.getSnapshot()).toMatchObject({ error: null, complete: true, liturgies: [{ id: 303 }] })
})

it('keeps showing exactly what was sent while an outcome is open, even across a stale bootstrap', async () => {
  let clock = 0
  const { fetcher, controller } = setup([new TypeError('Network request failed')], () => clock)
  await ready(controller)
  controller.submit(); await flush()
  expect(controller.getSnapshot().phase).toBe('uncertain')
  clock = 2 * 60 * 60 * 1000
  fetcher.mockResolvedValueOnce(respond(200, { ...fixtures.bootstrap, defaults: { date: '2026-09-28', options: {} } }))
  controller.focus(); await flush()
  expect(controller.getSnapshot().draft.date).toBe('2026-09-27')
  expect(fetcher.mock.calls.filter(([path]) => path === '/s/new.json')).toHaveLength(1)
})

it('clears the error summary once every highlighted field is fixed', async () => {
  const { controller } = setup([])
  controller.focus(); await flush()
  controller.submit()
  expect(controller.getSnapshot()).toMatchObject({ errorKind: 'validation', error: expect.any(String) })
  controller.update(draft => addLiturgy(draft, liturgy))
  expect(controller.getSnapshot()).toMatchObject({ errorKind: null, error: null, fields: {} })
})

it('treats a forbidden bootstrap as final, without a futile retry', async () => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(respond(403, {}))
  const controller = createCreationController(fetcher)
  controller.focus(); await flush()
  expect(controller.getSnapshot()).toMatchObject({ unavailable: true, bootstrapError: 'Your account cannot create sessions here.' })
})

it.each([429, 408, 400])('keeps the held key when a safe retry is answered %s', async status => {
  const { fetcher, controller } = setup([new TypeError('Network request failed'), respond(status, {})])
  await ready(controller)
  controller.submit(); await flush()
  const held = controller.pendingAttempt()
  controller.retrySafely(); await flush()
  expect(controller.getSnapshot().phase).toBe('uncertain')
  expect(controller.pendingAttempt()).toBe(held)
  fetcher.mockResolvedValueOnce(respond(200, fixtures.replayed))
  controller.retrySafely(); await flush()
  const keys = posts(fetcher).map(([, init]) => JSON.parse(String(init?.body)).client_request_id)
  expect(new Set(keys).size).toBe(1)
  expect(controller.getSnapshot().phase).toBe('created')
})
