import { expect, it, jest } from '@jest/globals'
import { Slot } from 'expo-router'
import { renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { LibraryProvider } from '../features/library/LibraryProvider'
import { LiturgyReader } from '../features/library/LiturgyReader'
import { createLibrary } from '../features/library/downloadCoordinator'
import { parseBundle, parseCatalog } from '../features/library/contracts'
import { memoryStore } from './library-test-helpers'
import fixture from './fixtures/public_liturgies/bundle.json'
import catalog from './fixtures/public_liturgies/catalog.json'
jest.mock('../features/library/store', () => ({ libraryStore: { durable: false } }))
const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
it.each([
  ['/liturgies/701', true],
  ['/liturgies/701?environment=https%3A%2F%2Fevil.example', false],
  ['/liturgies/701?environment=', false],
  ['/liturgies/701?environment=test&environment=test', false],
] as const)('resolves real router params for %s', async (initialUrl, allowed) => {
  const api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn(async () => parseBundle(fixture)) }
  const controller = createLibrary('test', api, memoryStore())
  await renderRouter({
    _layout: () => <ThemeProvider><PreferencesProvider store={preferences}><LibraryProvider controller={controller}><Slot /></LibraryProvider></PreferencesProvider></ThemeProvider>,
    'liturgies/[id]/index': LiturgyReader,
  }, { initialUrl })
  if (allowed) {
    await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
    expect(api.bundle).toHaveBeenCalledTimes(1)
  } else {
    expect(screen.getByText('This service is no longer available.')).toBeTruthy()
    expect(api.bundle).not.toHaveBeenCalled()
  }
})
