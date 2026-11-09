import { afterEach, beforeEach, expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { isInterfaceLanguage, statusName, translate } from '../features/i18n'
import { formatMessage, lookupMessage } from '../features/i18n/messages'
import { PREFERENCES_KEY, PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider'
import { hasOwn } from '../features/shared/hasOwn'
import { memoryStore } from './auth-helpers'

const hasOwnDescriptor = Object.getOwnPropertyDescriptor(Object, 'hasOwn')!
beforeEach(() => { Reflect.deleteProperty(Object, 'hasOwn') })
afterEach(() => { Object.defineProperty(Object, 'hasOwn', hasOwnDescriptor) })

it('checks own keys without trusting inherited or shadowed hasOwnProperty methods', () => {
  expect(Object.hasOwn).toBeUndefined()
  const dictionary = Object.assign(Object.create(null), { title: 'Done', hasOwnProperty: 'shadowed' })
  expect(hasOwn(dictionary, 'title')).toBe(true)
  expect(hasOwn(dictionary, 'hasOwnProperty')).toBe(true)
  expect(hasOwn(dictionary, 'toString')).toBe(false)
  expect(hasOwn(Object.create({ title: 'inherited' }), 'title')).toBe(false)
  expect(hasOwn(JSON.parse('{"__proto__":"own"}'), '__proto__')).toBe(true)
})

it('looks up and formats translations while rejecting inherited keys', () => {
  expect(translate('en', 'common.done')).toBe('Done')
  expect(translate('ru', 'common.done')).toBe('Готово')
  expect(translate('en', 'no.such.key' as never)).toBe('no.such.key')
  expect(translate('en', 'control.positionLabel', { position: 2, total: 5 })).toBe('Part 2 of 5')
  expect(formatMessage('ru', { one: '{count} язык', few: '{count} языка', many: '{count} языков', other: '{count}' }, { count: 3 })).toBe('3 языка')
  const catalog = Object.assign(Object.create(null), { nested: { title: 'Own message' }, hasOwnProperty: 'A message' })
  expect(lookupMessage(catalog, 'nested.title')).toBe('Own message')
  expect(lookupMessage(catalog, 'hasOwnProperty')).toBe('A message')
  expect(lookupMessage({ nested: Object.create({ title: 'Inherited' }) }, 'nested.title')).toBeUndefined()
  expect(lookupMessage({}, 'constructor')).toBeUndefined()
  const params = Object.assign(Object.create({ inherited: 'hidden' }), { own: 'visible', hasOwnProperty: 'shadowed' })
  expect(formatMessage('en', '{own} {inherited} {hasOwnProperty} {missing}', params)).toBe('visible {inherited} shadowed {missing}')
})

it('validates interface languages and translates only known statuses', () => {
  expect(isInterfaceLanguage('en')).toBe(true)
  expect(isInterfaceLanguage('ru')).toBe(true)
  for (const value of ['xx', 'constructor', '__proto__', 'toString', null, 1]) expect(isInterfaceLanguage(value)).toBe(false)
  expect(statusName('showing_gospel', 'ru')).toBe('Чтение Евангелия')
  expect(statusName('showing_hymn_board', 'en')).toBe('Showing hymn board')
  expect(statusName('constructor', 'en')).toBe('Constructor')
})

it.each(['larger', 'constructor', '__proto__'])('hydrates and updates preferences without Object.hasOwn (stored size: %s)', async readingSize => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({
    language: 'ru', selectedLanguages: ['ru', 'grabar'], appearance: 'dark', readingSize,
    interfaceLanguage: readingSize === 'larger' ? 'ru' : 'constructor',
  }) })
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider store={store}>{children}</PreferencesProvider>
  const { result } = await renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences).toMatchObject({
    language: 'ru', selectedLanguages: ['ru', 'grabar'], appearance: 'dark',
    readingSize: readingSize === 'larger' ? 'larger' : 'standard',
  })
  expect(result.current.preferences.interfaceLanguage).toBe(readingSize === 'larger' ? 'ru' : undefined)
  expect(store.remove).not.toHaveBeenCalled()
  await act(async () => { result.current.setReadingSize('extraLarge'); result.current.setInterfaceLanguage('en') })
  await waitFor(() => expect(JSON.parse(String(store.set.mock.calls.at(-1)?.[1]))).toMatchObject({
    language: 'ru', appearance: 'dark', readingSize: 'extraLarge', interfaceLanguage: 'en',
  }))
  const validPreferences = result.current.preferences
  await act(async () => {
    result.current.setReadingSize('constructor' as never)
    result.current.setInterfaceLanguage('__proto__' as never)
  })
  expect(result.current.preferences).toBe(validPreferences)
})
