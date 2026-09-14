import { expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { PREFERENCES_KEY, PreferencesProvider, resolveControlLanguages, usePreferences } from '../features/preferences/PreferencesProvider'
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
    // A record from before the three-language limit keeps its reading language and the next two in turn.
    selectedLanguages: ['en', 'grabar', 'translit'],
    appearance: 'system',
    readingSize: 'standard',
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
  await act(async () => result.current.setSelectedLanguages(['en', 'ru']))
  await act(async () => result.current.setLanguage('ru'))
  expect(result.current.preferences.language).toBe('ru')
  await act(async () => result.current.setSelectedLanguages(['translit', 'ru']))
  expect(result.current.preferences).toMatchObject({ language: 'ru', selectedLanguages: ['ru', 'translit'] })
  await act(async () => result.current.setAppearance('dark'))
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual({
    language: 'ru',
    selectedLanguages: ['ru', 'translit'],
    appearance: 'dark',
    readingSize: 'standard',
  }))
  await act(async () => result.current.clear())
  expect(result.current.preferences).toEqual({
    language: 'en',
    selectedLanguages: ['en', 'grabar', 'translit'],
    appearance: 'dark',
    readingSize: 'standard',
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
  await act(async () => result.current.setLanguage('translit'))
  hydration.resolve(JSON.stringify({ language: 'grabar' }))
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.language).toBe('translit')
})

it('persists reading size, tolerates older records and resets size with reading choices', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'ru', selectedLanguages: ['ru'], appearance: 'dark', readingSize: 'unknown' }) })
  const { result, unmount } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences.readingSize).toBe('standard')
  await act(async () => result.current.setReadingSize('extraLarge'))
  await waitFor(() => expect(JSON.parse(String(saved(store))).readingSize).toBe('extraLarge'))
  await unmount()
  const restored = await setup(store)
  await waitFor(() => expect(restored.result.current.ready).toBe(true))
  expect(restored.result.current.preferences).toMatchObject({ readingSize: 'extraLarge', language: 'ru', appearance: 'dark' })
  await act(async () => restored.result.current.clear())
  expect(restored.result.current.preferences).toMatchObject({ readingSize: 'standard', language: 'en', appearance: 'dark' })
})

it('keeps service control languages in the order chosen, up to three, on this device', async () => {
  const { store } = memoryStore()
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  // Until chosen, control follows the reading language with Grabar beside it, and the reading screen is untouched.
  expect(resolveControlLanguages(result.current.preferences)).toEqual(['en', 'grabar'])
  await act(async () => result.current.setControlLanguages(['grabar', 'translit', 'grabar', 'en', 'ru']))
  expect(result.current.preferences.controlLanguages).toEqual(['grabar', 'translit', 'en'])
  expect(result.current.preferences.selectedLanguages).toEqual(['en', 'grabar', 'translit'])
  await waitFor(() => expect(JSON.parse(String(saved(store))).controlLanguages).toEqual(['grabar', 'translit', 'en']))
  await act(async () => result.current.setControlLanguages([]))
  expect(result.current.preferences.controlLanguages).toEqual(['grabar', 'translit', 'en'])
  await act(async () => result.current.clear())
  expect(result.current.preferences.controlLanguages).toBeUndefined()
})

it('drops an unreadable control arrangement without losing the other reading choices', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'ru', selectedLanguages: ['ru', 'grabar'], appearance: 'dark', readingSize: 'larger', controlLanguages: ['kl', 7] }) })
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences).toEqual({ language: 'ru', selectedLanguages: ['ru', 'grabar'], appearance: 'dark', readingSize: 'larger' })
  expect(resolveControlLanguages(result.current.preferences)).toEqual(['ru', 'grabar'])
  await waitFor(() => expect(JSON.parse(String(saved(store)))).toEqual(result.current.preferences))
})

it('never keeps more than three reading languages, keeping the one being read', async () => {
  const { store } = memoryStore({ [PREFERENCES_KEY]: JSON.stringify({ language: 'ru', selectedLanguages: ['en', 'ru', 'grabar', 'translit'], appearance: 'system', readingSize: 'standard' }) })
  const { result } = await setup(store)
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.preferences).toMatchObject({ language: 'ru', selectedLanguages: ['en', 'ru', 'grabar'] })
  await waitFor(() => expect(JSON.parse(String(saved(store))).selectedLanguages).toEqual(['en', 'ru', 'grabar']))
  await act(async () => result.current.setSelectedLanguages(['en', 'ru', 'grabar', 'translit']))
  expect(result.current.preferences.selectedLanguages).toHaveLength(3)
  expect(result.current.preferences.selectedLanguages).toContain('ru')
})
