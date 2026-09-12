import { expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { PREFERENCES_KEY, PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider'
import { memoryStore } from './auth-helpers'

function setup(store: ReturnType<typeof memoryStore>['store']) {
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider store={store}>{children}</PreferencesProvider>
  return renderHook(() => usePreferences(), { wrapper })
}
const saved = (store: ReturnType<typeof memoryStore>['store']) => store.set.mock.calls.at(-1)?.[1] ?? null

it('reads a stored reading language, as it would after a restart', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'grabar' }) })
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.language).toBe('grabar')
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
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual({ language: 'ru' }))
  await act(async () => result.current.clear())
  expect(result.current.preferences.language).toBe('en')
  await waitFor(() => expect(store.remove).toHaveBeenCalledWith(PREFERENCES_KEY))
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
