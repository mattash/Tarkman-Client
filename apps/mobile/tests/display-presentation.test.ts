import { expect, it } from '@jest/globals'
import { readScannedLink } from '../features/scan/links'
import { sessionReaderUrl } from '../features/displayLinks/sessionReaderUrl'
import { DEFAULT_DISPLAY_CONFIG } from '../features/displayLinks/config'
import { displayPosture, projectionMessage, projectionText, statusPageNumber, statusPostureKey } from '../features/displayLinks/presentation'
import { normalizeParts, normalizeSession, normalizeState, sessionWithState } from '../features/live/contracts'
const parts = normalizeParts({ parts: [
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 101, position: 1, page: 12 } },
  { part: { id: 2, liturgy_id: 10, liturgy_part_id: 102, position: 2, page: 13 } },
  { part: { id: 1, liturgy_id: 10, liturgy_part_id: 103, position: 3, page: 14 } },
] })
const raw = { id: 7, current_part_id: 2, current_liturgy_id: 10, current_liturgy_part_id: 102, current_part_position: 2, num_of_parts: 3,
  page: 13, posture: 'stand', options: { before_message: 'Welcome to our parish.', after_message: 'Go with God.', gospel: 'The Gospel of John.', epistle: 'The Letter to the Romans.' } }
const session = normalizeSession({ session: raw })
it.each([
  ['paused', 'Service paused', 'We will resume shortly.'],
  ['showing_gospel', 'Gospel', 'The Gospel of John.'],
  ['showing_epistle', 'Epistle', 'The Letter to the Romans.'],
  ['showing_welcome', 'Welcome', 'Welcome to our parish.'],
  ['showing_custom', 'Announcement', 'We will resume shortly.'],
])('renders the operator interrupt %s', (status, title, body) => {
  expect(projectionMessage({ ...session, status, message: 'We will resume shortly.' }, parts, DEFAULT_DISPLAY_CONFIG)).toEqual({ kind: 'message', title, body })
})
it('honors both notification suppression and the text-only status preference', () => {
  expect(projectionMessage({ ...session, status: 'paused' }, parts, { ...DEFAULT_DISPLAY_CONFIG, show_notifications: false })).toBeNull()
  expect(projectionMessage({ ...session, status: 'showing_custom' }, parts, { ...DEFAULT_DISPLAY_CONFIG, status_view: 'none' })).toBeNull()
  expect(projectionMessage({ ...session, status: 'future_unknown' }, parts, DEFAULT_DISPLAY_CONFIG)).toBeNull()
})
it('uses occurrence boundaries for welcome and farewell, not reusable part IDs', () => {
  expect(projectionMessage(session, parts, DEFAULT_DISPLAY_CONFIG)).toBeNull()
  expect((projectionMessage({ ...session, currentPartId: 1, currentLiturgyPartId: 101, currentPosition: 1 }, parts, DEFAULT_DISPLAY_CONFIG) as { body: string })?.body).toBe('Welcome to our parish.')
  expect((projectionMessage({ ...session, currentPartId: 1, currentLiturgyPartId: 103, currentPosition: 3 }, parts, DEFAULT_DISPLAY_CONFIG) as { body: string })?.body).toBe('Go with God.')
  expect((projectionMessage({ ...session, currentPartId: 1, currentLiturgyPartId: 103, currentPosition: 3, status: 'paused' }, parts, DEFAULT_DISPLAY_CONFIG) as { title: string })?.title).toBe('Service paused')
})
it('supports old zero-position welcome snapshots', () => {
  const old = normalizeSession({ session: { ...raw, current_part_position: 0 } })
  expect(old.currentPosition).toBe(0)
  expect((projectionMessage(old, [], DEFAULT_DISPLAY_CONFIG) as { title: string })?.title).toBe('Welcome')
})
it('preserves page, posture and display messages from public snapshots', () => {
  expect(session).toMatchObject({ page: 13, posture: 'stand', totalParts: 3, displayMessages: { before: 'Welcome to our parish.' } })
})
it('advances page and posture on compact publications without retaining an old page', () => {
  const update = normalizeState({ session: { id: 7, revision: 2, content_context: 'v1', cursor: { part_id: 1, liturgy_part_id: 103, liturgy_id: 10, position: 3 }, status: 'active', status_message: null, posture: 'sit', date: null } })
  expect(sessionWithState(session, update, parts)).toMatchObject({ page: 14, posture: 'sit', currentLiturgyPartId: 103 })
  expect(sessionWithState(session, { ...update, cursor: null }, parts).page).toBeNull()
})
it('normalizes malformed optional presentation fields without rejecting the service', () => {
  const invalid = normalizeSession({ session: { ...raw, options: [], page: -1, posture: 3, num_of_parts: '3' } })
  expect(invalid).toMatchObject({ page: null, posture: null, totalParts: null, displayMessages: { before: null } })
})
it('recognizes posture instructions without inventing unknown ones', () => {
  expect(displayPosture('Standing')).toBe('Stand')
  expect(displayPosture('sit')).toBe('Sit')
  expect(displayPosture('kneeling')).toBe('Kneel')
  expect(displayPosture('unknown')).toBeNull()
})
it('converts legacy HTML to safe readable text without injecting executable markup', () => {
  expect(projectionText('<p>Blessed &amp; holy<br>Word</p><script>alert(1)</script>')).toBe('Blessed & holy\nWord')
  expect(projectionText('&#x531; &lt;word&gt;')).toBe('Ա <word>')
  expect(projectionText('   ')).toBeNull()
})

it.each([
  [null, 'stand'], [undefined, 'stand'], ['', 'stand'], [' \t\n', 'stand'],
  ['stand', 'stand'], [' Standing ', 'stand'], ['SIT', 'sit'], [' sitting ', 'sit'],
  ['Kneel', 'kneel'], [' KNEELING ', 'kneel'], ['unknown', null], [' stand up ', null],
])('resolves status posture %p to %p without broadening strict recognition', (value, expected) => {
  expect(statusPostureKey(value)).toBe(expected)
})
it.each([null, undefined, 0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '12', '', {}, true])(
  'rejects invalid page %p and falls back only to a valid occurrence page', value => {
    expect(statusPageNumber(value, 42)).toBe(42)
    expect(statusPageNumber(value, value)).toBeNull()
    expect(statusPageNumber(24, value)).toBe(24)
  },
)
it('keeps valid session pages authoritative, including the safe integer boundary', () => {
  expect(statusPageNumber(1, 42)).toBe(1)
  expect(statusPageNumber(Number.MAX_SAFE_INTEGER, 42)).toBe(Number.MAX_SAFE_INTEGER)
  expect(statusPageNumber(null, Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
})

it('generates a canonical scanner-compatible credential-free reader URL', () => {
  const url = sessionReaderUrl(4008)
  expect(url).toBe('https://web.tarkman.app/sessions/4008/parts')
  expect(readScannedLink(url)).toEqual({ kind: 'service', sessionId: 4008, path: '/sessions/4008/parts' })
  expect(() => sessionReaderUrl(0)).toThrow()
})
it('presents QR as structured interruption and suppresses it with operator overlays', () => {
  const qr = { ...session, id: 4008, status: 'showing_session_qr', message: null }
  expect(projectionMessage(qr, parts, DEFAULT_DISPLAY_CONFIG)).toEqual({ kind: 'session_qr', sessionId: 4008, url: sessionReaderUrl(4008) })
  expect(projectionMessage(qr, parts, { ...DEFAULT_DISPLAY_CONFIG, show_notifications: false })).toBeNull()
  expect(projectionMessage(qr, parts, { ...DEFAULT_DISPLAY_CONFIG, status_view: 'none' })).toBeNull()
})
