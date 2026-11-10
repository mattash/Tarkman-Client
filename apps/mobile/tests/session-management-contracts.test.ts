import { expect, it, jest } from '@jest/globals'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { createSession, fetchBootstrap, fetchLiturgyOptions } from '../features/services/management/api'
import {
  isCalendarDate, isManagementError, normalizeBootstrap, normalizeCreateResult, normalizeLiturgyOptions, normalizeManagedSession, setupDiff,
} from '../features/services/management/contracts'
import { mapFieldErrors, moveLiturgy, shiftDate, todayIn } from '../features/services/management/draft'
import { respond } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

const fetcher = () => jest.fn<AuthContextValue['authorizedFetch']>()
const signal = () => new AbortController().signal
const setup = { date: '2026-10-04', liturgy_ids: [101, 202], options: { gospel: '', epistle: '', prophetic: '', before_message: '', after_message: '' } }

it('accepts only real calendar dates, without a time zone', () => {
  expect(['2026-09-27', '2024-02-29', '2000-02-29', '0001-01-01'].every(isCalendarDate)).toBe(true)
  expect(['2026-02-29', '1900-02-29', '2026-13-01', '2026-04-31', '2026-9-27', '2026-09-27T00:00:00Z', '', null].some(isCalendarDate)).toBe(false)
})

it('shifts days across month, leap-day, and DST boundaries without drifting', () => {
  expect(shiftDate('2026-03-08', 1)).toBe('2026-03-09') // US DST starts
  expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31') // US DST ends
  expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29')
  expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  expect(shiftDate('0050-01-01', 1)).toBe('0050-01-02') // Date.UTC would map year 50 to 1950
  expect(shiftDate('0001-01-01', -1)).toBe('0001-01-01')
})

it('computes today in the backend zone, near UTC midnight', () => {
  const lateUtc = new Date('2026-09-28T02:30:00Z') // still Sept 27 in Los Angeles
  expect(todayIn('America/Los_Angeles', 'x', lateUtc)).toBe('2026-09-27')
  expect(todayIn('Asia/Yerevan', 'x', lateUtc)).toBe('2026-09-28')
  expect(todayIn('Not/AZone', '2026-01-01', lateUtc)).toBe('2026-01-01')
})

it('reads the version-1 bootstrap and rejects any other version or shape as unavailable', () => {
  expect(normalizeBootstrap(fixtures.bootstrap)).toMatchObject({ timeZone: 'America/Los_Angeles', defaultDate: '2026-09-27',
    limits: { maxLiturgies: 10, optionMaxLength: { gospel: 500 } } })
  for (const body of [{ ...fixtures.bootstrap, session_management_version: 2 }, { ...fixtures.bootstrap, schema_version: 0 },
    { ...fixtures.bootstrap, defaults: { date: '2026-02-30' } }, { ...fixtures.bootstrap, time_zone: '' }, '<html>', null]) {
    expect(() => normalizeBootstrap(body)).toThrow(expect.objectContaining({ kind: 'unavailable' }))
  }
})

it('reads keyset catalog pages and rejects malformed ones', () => {
  expect(normalizeLiturgyOptions(fixtures.liturgyPage1)).toEqual({ nextAfterId: 202,
    liturgies: [{ id: 101, name: 'Divine Liturgy', selectable: true, usageCount: null }, { id: 202, name: 'Morning Service', selectable: true, usageCount: null }] })
  const counted = normalizeLiturgyOptions({ ...fixtures.liturgyPage2, liturgies: [{ id: 1, name: 'A', usage_count: 4 }, { id: 2, name: 'B', usage_count: -1 }, { id: 3, name: 'C', usage_count: '9' }] })
  expect(counted.liturgies.map(item => item.usageCount)).toEqual([4, null, null])
  expect(normalizeLiturgyOptions(fixtures.liturgyPage2).nextAfterId).toBeNull()
  for (const body of [{ ...fixtures.liturgyPage1, next_after_id: 'x' }, { ...fixtures.liturgyPage1, liturgies: [{ id: 'a', name: 'A' }] },
    { liturgies: [], next_after_id: null }, { schema_version: 1, liturgies: null, next_after_id: null }]) {
    expect(() => normalizeLiturgyOptions(body)).toThrow()
  }
})

it('reads the canonical nested session in position order and never the legacy top-level fields', () => {
  const shuffled = fixtures.managedSession({ liturgy_ids: [202, 101], liturgies: [
    { id: 101, name: 'Divine Liturgy', position: 2, selectable: false }, { id: 202, name: 'Morning Service', position: 1, selectable: true }] })
  const session = normalizeManagedSession({ id: 1, session: shuffled })
  expect(session.liturgies.map(item => [item.id, item.selectable])).toEqual([[202, true], [101, false]])
  expect(session.title).toBe('Morning Service · Divine Liturgy')
  expect(() => normalizeManagedSession({ id: 4008, date: '2026-10-04' })).toThrow()
  expect(() => normalizeManagedSession({ session: fixtures.managedSession({ liturgy_ids: [101] }) })).toThrow()
})

it('treats 201 and replayed 200 as the same accepted creation, and anything unreadable as uncertain', () => {
  expect(normalizeCreateResult(fixtures.created, 201)).toMatchObject({ replayed: false, session: { id: 4008 } })
  expect(normalizeCreateResult(fixtures.replayed, 200)).toMatchObject({ replayed: true, session: { id: 4008 } })
  for (const [body, status] of [[fixtures.created, 200], [{ id: 4008 }, 201], [undefined, 201]] as const) {
    expect(() => normalizeCreateResult(body, status)).toThrow(expect.objectContaining({ kind: 'uncertain' }))
  }
})

it('sends only the allowlisted setup with the request key and JSON content type', async () => {
  const request = fetcher().mockResolvedValue(respond(201, fixtures.created))
  const draft = { ...setup, user_id: 9, status: 'paused', revision: 3 } as typeof setup
  await createSession(request, { clientRequestId: 'key-1', setup: draft, startedAt: 0 })
  const [path, init] = request.mock.calls[0]
  expect(path).toBe('/s.json')
  expect(init?.method).toBe('POST')
  expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
  expect(JSON.parse(String(init?.body))).toEqual({ client_request_id: 'key-1', session: setup })
})

it.each([
  [422, fixtures.validation, 'validation'], [403, {}, 'forbidden'], [409, fixtures.idempotencyConflict, 'conflict'],
  [409, fixtures.creationResultUnavailable, 'creationDeleted'], [500, {}, 'uncertain'], [502, undefined, 'uncertain'],
  [404, undefined, 'unavailable'], [405, {}, 'unavailable'], [406, {}, 'unavailable'],
  [429, {}, 'network'], [408, {}, 'network'], [400, {}, 'rejected'], [409, { code: 'something_new' }, 'rejected'],
])('maps a create %s to %s', async (status, body, kind) => {
  const request = fetcher().mockResolvedValue(respond(status as number, body))
  await expect(createSession(request, { clientRequestId: 'k', setup, startedAt: 0 })).rejects.toMatchObject({ kind })
})

it('reports network failure and aborts on a create as uncertain, never as failed', async () => {
  const request = fetcher().mockRejectedValue(new TypeError('Network request failed'))
  const failure = await createSession(request, { clientRequestId: 'k', setup, startedAt: 0 }).catch(error => error)
  expect(isManagementError(failure, 'uncertain')).toBe(true)
})

it('maps validation fields onto the form, keeping the rest for the summary', () => {
  expect(mapFieldErrors({ liturgy_ids: ['gone'], 'options.gospel': ['long'], base: ['odd'], date: ['bad', 'worse'] }))
    .toEqual({ byField: { liturgy_ids: 'gone', gospel: 'long', date: 'bad worse' }, other: ['odd'] })
})

it('builds catalog requests with server search and a keyset continuation', async () => {
  const request = fetcher().mockResolvedValue(respond(200, fixtures.liturgyPage2))
  await fetchLiturgyOptions(request, signal(), '  Evening & more ', 202)
  expect(request.mock.calls[0][0]).toBe('/s/liturgy_options.json?limit=50&after_id=202&q=Evening%20%26%20more')
})

it('treats HTML or an old server bootstrap as unavailable, and a thrown fetch as offline', async () => {
  const html = { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected <') }, headers: { get: () => null } } as unknown as Response
  await expect(fetchBootstrap(fetcher().mockResolvedValue(html), signal())).rejects.toMatchObject({ kind: 'unavailable' })
  await expect(fetchBootstrap(fetcher().mockResolvedValue(respond(404, {})), signal())).rejects.toMatchObject({ kind: 'unavailable' })
  await expect(fetchBootstrap(fetcher().mockRejectedValue(new TypeError('offline')), signal())).rejects.toMatchObject({ kind: 'network' })
})

it('normalizes missing or null prophetic values and preserves deliberate edits and clearing', () => {
  const saved = fixtures.managedSession()
  expect(normalizeManagedSession({ session: { ...saved, options: {} } }).options.prophetic).toBe('')
  expect(normalizeManagedSession({ session: { ...saved, options: { prophetic: null } } }).options.prophetic).toBe('')
  expect(normalizeManagedSession({ session: { ...saved, options: { prophetic: 'Isaiah 7:10-16' } } }).options.prophetic).toBe('Isaiah 7:10-16')
  expect(setupDiff(setup, { ...setup, options: { ...setup.options, prophetic: 'Isaiah 7:10-16' } })).toEqual({ options: { prophetic: 'Isaiah 7:10-16' } })
  const filled = { ...setup, options: { ...setup.options, prophetic: 'Isaiah 7:10-16' } }
  expect(setupDiff(filled, setup)).toEqual({ options: { prophetic: '' } })
  expect(mapFieldErrors({ 'options.prophetic': ['too long'] })).toEqual({ byField: { prophetic: 'too long' }, other: [] })
})

it('diffs key-wise and only reports deliberate changes', () => {
  const base = { ...setup, options: { ...setup.options, gospel: 'John 1' } }
  expect(setupDiff(base, base)).toBeNull()
  expect(setupDiff(base, { ...base, options: { ...base.options, gospel: '' } })).toEqual({ options: { gospel: '' } })
  expect(setupDiff(base, { ...base, liturgy_ids: [202, 101] })).toEqual({ liturgy_ids: [202, 101] })
  const draft = { date: '2026-10-04', options: setup.options, liturgies: [{ id: 1, name: 'A', selectable: true }, { id: 2, name: 'B', selectable: true }] }
  expect(moveLiturgy(draft, 2, -1).liturgies.map(item => item.id)).toEqual([2, 1])
  expect(moveLiturgy(draft, 1, -1)).toBe(draft)
})
