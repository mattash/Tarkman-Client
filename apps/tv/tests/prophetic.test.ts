import { expect, it } from '@jest/globals'
import { createContracts, DEFAULT_DISPLAY_CONFIG, projectionMessage } from '@tarkman/reader'
import { en } from '../src/i18n/en'
import { ru } from '../src/i18n/ru'
import { translate } from '../src/i18n'

it.each(['en', 'ru'] as const)('localizes prophetic projection and status in %s', language => {
  const { normalizeSession } = createContracts(key => key)
  const session = normalizeSession({ session: { id: 7, status: 'showing_prophetic', options: { prophetic: 'Եսայի / Исаия 1:1' } } })
  const catalog = language === 'ru' ? ru : en
  expect(session.status).toBe('showing_prophetic')
  expect(translate(language, 'statuses.showing_prophetic')).toBe(catalog.statuses.showing_prophetic)
  expect(projectionMessage(session, [], DEFAULT_DISPLAY_CONFIG, key => translate(language, key))).toEqual({ kind: 'message', title: catalog.display.prophetic, body: 'Եսայի / Исаия 1:1' })
})
