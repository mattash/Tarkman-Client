import { expect, it } from '@jest/globals'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { en } from '../features/i18n/catalogs/en'
import {
  activeInterfaceLanguage, availableInterfaceLanguages, I18nProvider, INTERFACE_CATALOGS, resolveInterfaceLanguage, statusName, t, translate, useI18n,
  type InterfaceLanguage,
} from '../features/i18n'
import { formatMessage, isPluralMessage, placeholders, pluralCategory, type Message } from '../features/i18n/messages'
import { PREFERENCES_KEY, PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider'
import { memoryStore } from './auth-helpers'

/** Every message path in a catalog, with its message. */
function messages(node: unknown, prefix = ''): [string, Message][] {
  if (typeof node === 'string' || isPluralMessage(node)) return [[prefix, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => messages(value, prefix ? `${prefix}.${key}` : key))
}
const english = new Map(messages(en))
const requiredForms: Record<string, readonly string[]> = { en: ['one', 'other'], ru: ['one', 'few', 'many', 'other'] }

it.each(Object.keys(INTERFACE_CATALOGS) as InterfaceLanguage[])('the %s catalog has every English message, with the same placeholders', language => {
  const catalog = new Map(messages(INTERFACE_CATALOGS[language].catalog))
  expect([...catalog.keys()].sort()).toEqual([...english.keys()].sort())
  for (const [key, source] of english) {
    const message = catalog.get(key)!
    expect({ key, placeholders: placeholders(message) }).toEqual({ key, placeholders: placeholders(source) })
    if (typeof message === 'string') expect({ key, empty: message.trim().length === 0 }).toEqual({ key, empty: false })
    else {
      expect({ key, plural: typeof source !== 'string' }).toEqual({ key, plural: true })
      for (const form of requiredForms[language] ?? ['other']) {
        expect({ key, form, present: typeof message[form as keyof typeof message] === 'string' }).toEqual({ key, form, present: true })
      }
    }
  }
})

it('fills placeholders, leaves unknown ones visible and chooses plural forms by count', () => {
  expect(formatMessage('en', 'Close {title}', { title: 'Languages' })).toBe('Close Languages')
  expect(formatMessage('en', 'Close {title}')).toBe('Close {title}')
  expect(formatMessage('en', { one: '{count} language', other: '{count} languages' }, { count: 1 })).toBe('1 language')
  expect(formatMessage('en', { one: '{count} language', other: '{count} languages' }, { count: 3 })).toBe('3 languages')
  expect(t('control.positionLabel', { position: 4, total: 12 })).toBe('Part 4 of 12')
})

it('uses Russian plural categories for whole numbers', () => {
  expect([1, 21, 101].map(count => pluralCategory('ru', count))).toEqual(['one', 'one', 'one'])
  expect([2, 3, 4, 22, 34].map(count => pluralCategory('ru', count))).toEqual(['few', 'few', 'few', 'few', 'few'])
  expect([0, 5, 11, 12, 14, 25, 111].map(count => pluralCategory('ru', count))).toEqual(['many', 'many', 'many', 'many', 'many', 'many', 'many'])
  expect(pluralCategory('ru', 1.5)).toBe('other')
  expect([1, 0, 2].map(count => pluralCategory('en', count))).toEqual(['one', 'other', 'other'])
})

it('falls back to English for a missing message and names only statuses it knows', () => {
  expect(translate('en', 'common.done')).toBe('Done')
  expect(translate('en', 'no.such.key' as never)).toBe('no.such.key')
  expect(statusName('showing_gospel')).toBe('Gospel Reading')
  expect(statusName('showing_hymn_board')).toBe('Showing hymn board')
})

it('follows an explicit choice, then the device languages, then English', () => {
  const available = ['en'] as InterfaceLanguage[]
  expect(resolveInterfaceLanguage(undefined, ['fr-FR', 'en-GB'], available)).toBe('en')
  expect(resolveInterfaceLanguage('system', [null, 'de'], available)).toBe('en')
  expect(resolveInterfaceLanguage('en', ['fr'], available)).toBe('en')
  // An unreviewed draft is offered only where testers can check it.
  const drafts = availableInterfaceLanguages(true), released = availableInterfaceLanguages(false)
  expect(released.every(language => INTERFACE_CATALOGS[language].reviewed)).toBe(true)
  expect(drafts).toEqual(expect.arrayContaining(released))
})

it('provides translation to screens and keeps code outside React in step', async () => {
  function Probe() {
    const { t: translateHere, language } = useI18n()
    return <Text>{`${language}:${translateHere('common.done')}`}</Text>
  }
  await render(<I18nProvider preference="system"><Probe /></I18nProvider>)
  expect(screen.getByText('en:Done')).toBeOnTheScreen()
  expect(activeInterfaceLanguage()).toBe('en')
})

it('stores the interface language, keeps it through a reading reset, and follows the device again on request', async () => {
  const { store } = memoryStore()
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider store={store}>{children}</PreferencesProvider>
  const { result } = await renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => { result.current.setInterfaceLanguage('en') })
  expect(result.current.preferences.interfaceLanguage).toBe('en')
  await act(async () => { result.current.clear() })
  expect(result.current.preferences.interfaceLanguage).toBe('en')
  await act(async () => { result.current.setInterfaceLanguage('system') })
  expect(result.current.preferences).not.toHaveProperty('interfaceLanguage')
  await act(async () => { result.current.setInterfaceLanguage('xx' as never) })
  expect(result.current.preferences).not.toHaveProperty('interfaceLanguage')
})

it('drops a stored interface language this build does not ship without losing reading choices', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'grabar', selectedLanguages: ['en', 'grabar'], interfaceLanguage: 'xx' }) })
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider store={store}>{children}</PreferencesProvider>
  const { result } = await renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.language).toBe('grabar')
  expect(result.current.preferences).not.toHaveProperty('interfaceLanguage')
  await waitFor(() => expect(store.set).toHaveBeenCalledWith(PREFERENCES_KEY, expect.not.stringContaining('interfaceLanguage')))
})
