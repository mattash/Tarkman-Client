import { it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { LibraryProvider } from '../features/library/LibraryProvider'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { LiturgyReader } from '../features/library/LiturgyReader'
import { createLibrary } from '../features/library/downloadCoordinator'
import { parseBundle, parseCatalog } from '../features/library/contracts'
import { memoryStore } from './library-test-helpers'
import fixture from './fixtures/public_liturgies/bundle.json'
import catalog from './fixtures/public_liturgies/catalog.json'
const mockPush = jest.fn()
const mockBack = jest.fn(), mockReplace = jest.fn()
const mockCanGoBack = true
const mockParams: { id: string; environment?: string | string[]; origin?: string } = { id: '701', environment: 'test', origin: 'library' }
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), canGoBack: () => mockCanGoBack, back: () => mockBack(), replace: (path: string) => mockReplace(path) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}))
jest.mock('../features/home/ServicesProvider', () => ({ useServices: () => ({ state: { loading: false, error: 'fixture offline', services: [{ id: 99, title: 'Fixture live', church: 'Fixture church', status: 'active' }] }, retry: jest.fn() }) }))
const mockNetwork = { isConnected: true, isInternetReachable: true }
jest.mock('expo-network', () => ({ getNetworkStateAsync: async () => mockNetwork, addNetworkStateListener: () => ({ remove: jest.fn() }) }))
jest.mock('../features/library/store', () => ({ libraryStore: { durable: false } }))
const preferences = { get: async (): Promise<string | null> => null, set: async () => {}, remove: async () => {} }
function setup(durable = true, preferenceStore = preferences) {
  const store = memoryStore(), api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn(async () => parseBundle(fixture)) }
  store.durable = durable
  const controller = createLibrary('test', api, store)
  const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferenceStore}><LibraryProvider controller={controller}>{children}</LibraryProvider></PreferencesProvider></ThemeProvider>
  return { store, api, controller, wrapper }
}

beforeEach(() => { mockParams.id = '701'; delete mockParams.environment })
it('reads a shared service without saving it', async () => {
  const { wrapper, api, controller } = setup()
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().items).toHaveLength(0)
  expect(screen.getByTestId('library-reader-share')).toBeTruthy()
})
it.each<[string | string[]]>([['other'], [''], [['test', 'test']]])('refuses explicit environment %s without a request', async environment => {
  mockParams.environment = environment
  const { wrapper, api } = setup()
  await render(<LiturgyReader />, { wrapper })
  expect(screen.getByText('This service is no longer available.')).toBeTruthy()
  expect(api.bundle).not.toHaveBeenCalled()
  expect(screen.queryByTestId('library-reader-share')).toBeNull()
})
it.each(['abc', '0', '-1', '1.5', '1e2', '0x10', '007', '9007199254740993'])('refuses invalid id %s without a request', async id => {
  mockParams.id = id
  const { wrapper, api } = setup()
  await render(<LiturgyReader />, { wrapper })
  expect(screen.getByText('Something went wrong with this service. Anything you saved is still here.')).toBeTruthy()
  expect(api.bundle).not.toHaveBeenCalled()
  expect(screen.queryByTestId('library-reader-share')).toBeNull()
})
it('keeps explicit matching in-app navigation working', async () => {
  mockParams.environment = 'test'
  const { wrapper } = setup()
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
})
it('serves a saved copy with no environment', async () => {
  const { wrapper, controller, api } = setup()
  await controller.request(701, true)
  api.bundle.mockClear()
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
  expect(api.bundle).not.toHaveBeenCalled()
})
it('shows disabled availability immediately without retry or sharing', async () => {
  const controller = createLibrary('disabled', null, memoryStore())
  await render(<ThemeProvider><PreferencesProvider store={preferences}><LibraryProvider controller={controller}><LiturgyReader /></LibraryProvider></PreferencesProvider></ThemeProvider>)
  expect(screen.getByText("Prayer Library isn’t available yet.")).toBeTruthy()
  expect(screen.queryByText('Read now')).toBeNull()
  expect(screen.queryByText('Loading…')).toBeNull()
  expect(screen.queryByTestId('library-reader-share')).toBeNull()
})
it('offers sharing on real cards but never saved-intent placeholders', async () => {
  const { wrapper, store } = setup()
  await store.intent('test', 999)
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-share-701')).toBeTruthy())
  expect(screen.queryByTestId('library-share-999')).toBeNull()
})

it('hides card sharing when the Library is disabled even with a saved bundle', async () => {
  const store = memoryStore()
  await store.commit('disabled', fixture, Date.now(), () => true)
  const controller = createLibrary('disabled', null, store)
  await render(<ThemeProvider><PreferencesProvider store={preferences}><LibraryProvider controller={controller}><LibraryScreen /></LibraryProvider></PreferencesProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByText(fixture.liturgy.name)).toBeTruthy())
  expect(screen.queryByTestId('library-share-701')).toBeNull()
})
