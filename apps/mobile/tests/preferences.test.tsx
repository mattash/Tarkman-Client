import { expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { PREFERENCES_KEY, PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider'
import { deferred, memoryStore } from './auth-helpers'

function setup(store: ReturnType<typeof memoryStore>['store']) {
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider store={store}>{children}</PreferencesProvider>
  return renderHook(() => usePreferences(), { wrapper })
}
const saved = (store: ReturnType<typeof memoryStore>['store']) => store.set.mock.calls.at(-1)?.[1] ?? null

it('migrates a stored reading language without losing the active choice', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'grabar' }) })
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences).toEqual({
    language: 'grabar',
    selectedLanguages: ['en', 'ru', 'grabar', 'translit'],
    appearance: 'system',
  })
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual(result.current.preferences))
})

it('falls back to English and forgets records it cannot use', async () => {
  for (const raw of ['{not json', JSON.stringify({ language: 'kl' }), JSON.stringify({ language: 7 })]) {
    const { store } = memoryStore({ [PREFERENCES_KEY]: raw })
    const { result } = await setup(store)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.preferences.language).toBe('en')
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith(PREFERENCES_KEY))
  }
})

it('keeps a chosen language and forgets it on request', async () => {
  const { store } = memoryStore()
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => result.current.setLanguage('ru'))
  expect(result.current.preferences.language).toBe('ru')
  await act(async () => result.current.setSelectedLanguages(['translit', 'ru']))
  expect(result.current.preferences).toMatchObject({ language: 'ru', selectedLanguages: ['ru', 'translit'] })
  await act(async () => result.current.setAppearance('dark'))
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual({
    language: 'ru',
    selectedLanguages: ['ru', 'translit'],
    appearance: 'dark',
  }))
  await act(async () => result.current.clear())
  expect(result.current.preferences).toEqual({
    language: 'en',
    selectedLanguages: ['en', 'ru', 'grabar', 'translit'],
    appearance: 'dark',
  })
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual(result.current.preferences))
})

it('still applies a choice for this run when storage rejects the write', async () => {
  const { store } = memoryStore()
  store.set.mockRejectedValue(new Error('disk full'))
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => result.current.setLanguage('translit'))
  expect(result.current.preferences.language).toBe('translit')
})

it('reads with defaults when storage is unavailable', async () => {
  const { store } = memoryStore()
  store.get.mockRejectedValue(new Error('unavailable'))
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.language).toBe('en')
})

it('falls back to the first selected language in stable product order', async () => {
  const { store } = memoryStore()
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => result.current.setLanguage('grabar'))
  await act(async () => result.current.setSelectedLanguages(['translit', 'ru']))
  expect(result.current.preferences).toMatchObject({ language: 'ru', selectedLanguages: ['ru', 'translit'] })
})

it('does not let late startup hydration replace an in-app choice', async () => {
  const hydration = deferred<string | null>()
  const { store } = memoryStore()
  store.get.mockImplementation(() => hydration.promise)
  const { result } = await setup(store)
  await act(async () => result.current.setLanguage('ru'))
  hydration.resolve(JSON.stringify({ language: 'grabar' }))
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.language).toBe('ru')
})
