import { STATUS_LABELS, sessionsKeys, SESSION_POLLING } from '@tarkman/core'

it('loads values through the source-linked core public entry point', () => {
  expect(STATUS_LABELS.showing_gospel).toBe('Gospel Reading')
  expect(sessionsKeys.sessionParts('42')).toEqual(['sessions', 'session', '42', 'parts'])
  expect(SESSION_POLLING.activeIntervalMs).toBe(1000)
})
