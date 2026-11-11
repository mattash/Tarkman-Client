import { expect, it, jest } from '@jest/globals'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { createSession } from '../features/services/management/api'
import { byUsageThenTitle, createCatalogController } from '../features/services/management/catalog'
import {
  normalizeBootstrap, normalizeCreateResult, normalizeEditSnapshot, normalizeLiturgyOptions, normalizeManagedSession, setupPayload,
} from '../features/services/management/contracts'
import { respond } from './auth-helpers'

/** The backend's own shared fixtures (mattash/Tarkman#454, docs/session-management/fixtures), copied verbatim. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const backend = (name: string): unknown => require(`./fixtures/backend-454/${name}.json`)
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

it('reads the bootstrap, including its real limits shape', () => {
  expect(normalizeBootstrap(backend('bootstrap.response'))).toEqual({
    timeZone: 'America/Los_Angeles', defaultDate: '2026-10-04',
    defaultOptions: { gospel: '', epistle: '', prophetic: '', before_message: 'Welcome!', after_message: 'Have a blessed Sunday!' },
    limits: { maxLiturgies: 20, optionMaxLength: { gospel: 20000, epistle: 20000, before_message: 5000, after_message: 5000 } },
  })
})

it('reads usage_count from both catalog pages and orders them like the backend form', async () => {
  const first = normalizeLiturgyOptions(backend('liturgy_options.response'))
  expect(first).toMatchObject({ nextAfterId: 31, liturgies: [{ id: 12, usageCount: 7 }, { id: 31, usageCount: 2 }] })
  expect(normalizeLiturgyOptions(backend('liturgy_options.final_page.response'))).toMatchObject({ nextAfterId: null, liturgies: [{ id: 44, usageCount: 0 }] })
  // Page order from the server is by ID; the sheet sorts by usage, then title.
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>()
  fetcher.mockResolvedValueOnce(respond(200, backend('liturgy_options.response'))).mockResolvedValueOnce(respond(200, backend('liturgy_options.final_page.response')))
  const catalog = createCatalogController(fetcher)
  catalog.ensureLoaded(); await flush()
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/s/liturgy_options.json?limit=50', '/s/liturgy_options.json?limit=50&after_id=31'])
  expect(catalog.getSnapshot().liturgies.map(item => `${item.name}:${item.usageCount}`)).toEqual(['Divine Liturgy:7', 'Parish Vespers:2', 'Morning Hours:0'])
  expect([...catalog.getSnapshot().liturgies].sort(byUsageThenTitle)).toEqual(catalog.getSnapshot().liturgies)
})

it('reads the canonical session from create (201), replay (200), edit, update and snapshot responses', () => {
  expect(normalizeCreateResult(backend('create.response.201'), 201)).toMatchObject({ replayed: false, session: { id: 4008, revision: 0, date: '2026-10-04' } })
  expect(normalizeCreateResult(backend('create.replay.response.200'), 200)).toMatchObject({ replayed: true, session: { id: 4008 } })
  expect(normalizeEditSnapshot(backend('edit.response'))).toMatchObject({ id: 4008, liturgies: [{ id: 12 }, { id: 31 }], options: { gospel: 'John 1:1-17' } })
  expect(normalizeManagedSession(backend('update.response'))).toMatchObject({ revision: 1, date: '2026-10-11' })
  expect(normalizeManagedSession({ session: backend('session.snapshot') })).toMatchObject({ id: 4008 })
})

it('extends the older documented create request with an empty prophetic reading', async () => {
  const request = backend('create.request') as { client_request_id: string; session: Parameters<typeof setupPayload>[0] }
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValue(respond(201, backend('create.response.201')))
  await createSession(fetcher, { clientRequestId: request.client_request_id, setup: request.session, startedAt: 0 })
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ ...request, session: { ...request.session, options: { ...request.session.options, prophetic: '' } } })
})

it.each([
  ['error.invalid_session.422', 422, 'validation'], ['error.idempotency_conflict.409', 409, 'conflict'],
  ['error.creation_result_unavailable.409', 409, 'creationDeleted'], ['error.stale_session.409', 409, 'stale'],
  ['error.cursor_reset_required.409', 409, 'cursorReset'], ['error.session_not_found.404', 404, 'notFound'],
  ['error.malformed_request.400', 400, 'rejected'],
])('maps %s to %s', async (name, status, kind) => {
  const fetcher = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValue(respond(status, backend(name)))
  const failure = await createSession(fetcher, { clientRequestId: 'k', setup: { date: '2026-10-04', liturgy_ids: [12], options: { gospel: '', epistle: '', prophetic: '', before_message: '', after_message: '' } }, startedAt: 0 }).catch(error => error)
  expect(failure).toMatchObject({ kind })
  if (kind === 'validation') expect(failure.fields).toEqual({ date: ['must be a valid calendar date (YYYY-MM-DD)'], 'options.gospel': ['must be a string or null'] })
})
