import { StrictMode } from 'react'
import { it, expect, jest } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { LibraryProvider } from '../features/library/LibraryProvider'
import { Services } from '../features/library/Services'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { LiturgyReader } from '../features/library/LiturgyReader'
import { LibraryManagement } from '../features/library/LibraryManagement'
import { createLibrary } from '../features/library/downloadCoordinator'
import { LibraryError, parseBundle, parseCatalog } from '../features/library/contracts'
import { memoryStore } from './library-test-helpers'
import fixture from './fixtures/public_liturgies/bundle.json'
import changed from './fixtures/public_liturgies/bundle_updated.json'
import catalog from './fixtures/public_liturgies/catalog.json'
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), canGoBack: () => true, back: jest.fn() },
  useLocalSearchParams: () => ({ id: '701', environment: 'test' }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}))
jest.mock('../features/home/ServicesProvider', () => ({ useServices: () => ({ state: { loading: false, error: 'fixture offline', services: [{ id: 99, title: 'Fixture live', church: 'Fixture church', status: 'active' }] }, retry: jest.fn() }) }))
jest.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: jest.fn() }) }))
jest.mock('../features/library/store', () => ({ libraryStore: { durable: false } }))
const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
function setup(durable = true) {
  const store = memoryStore(), api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn(async () => parseBundle(fixture)) }
  store.durable = durable
  const controller = createLibrary('test', api, store)
  const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}><LibraryProvider controller={controller}>{children}</LibraryProvider></PreferencesProvider></ThemeProvider>
  return { store, api, controller, wrapper }
}
it('opening Library and starters transfers nothing; deselect/Skip persists and quiet re-entry remains', async () => {
  const { wrapper, api, controller } = setup(); await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Choose downloads')).toBeTruthy())
  await fireEvent.press(screen.getByText('Choose downloads'))
  expect(api.bundle).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('checkbox'))
  expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false)
  await fireEvent.press(screen.getByText('Skip'))
  await waitFor(() => expect(controller.getSnapshot().dismissed).toBe(true))
  expect(screen.queryByText('Recommended to start')).toBeNull()
  expect(screen.getByText('Choose downloads')).toBeTruthy(); expect(api.bundle).not.toHaveBeenCalled()
})
it('explicit starter confirmation downloads only selected IDs', async () => {
  const { wrapper, api, controller } = setup(); await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Choose downloads')).toBeTruthy())
  await fireEvent.press(screen.getByText('Choose downloads')); await fireEvent.press(screen.getByText('Download selected'))
  await waitFor(() => expect(controller.getSnapshot().items[0]?.bundle).toBeTruthy())
  expect(api.bundle).toHaveBeenCalledTimes(1)
})
it('failed catalog leaves local downloads reachable; partial pages disclose incomplete search', async () => {
  const { wrapper, controller, api } = setup(); await controller.request(701, true)
  api.catalog.mockRejectedValue(new LibraryError('network'))
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText(/More results may remain/)).toBeTruthy())
  await fireEvent.press(screen.getByText('Read saved copy'))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/liturgies/[id]', params: { id: '701', environment: 'test' } })
})
it('manual reader pins saved revision, opens occurrence-owned explanations, and clears revoked content', async () => {
  const { wrapper, controller, api } = setup(); await controller.request(701, true)
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
  expect(screen.queryByText('Return to live')).toBeNull()
  expect(api.bundle).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getAllByRole('button', { name: 'choir' })[1])
  expect(screen.getByText('A synthetic note.')).toBeTruthy()
  api.bundle.mockResolvedValue(parseBundle(changed)); await act(async () => { await controller.request(701, true) })
  expect(screen.getByText('A synthetic note.')).toBeTruthy()
  expect(screen.getByText(/Updated copy available/)).toBeTruthy()
  api.bundle.mockRejectedValue(new LibraryError('unavailable')); await act(async () => { await controller.request(701, true) })
  expect(screen.queryByTestId('library-reader')).toBeNull()
  expect(screen.queryByText('A synthetic note.')).toBeNull()
  expect(screen.getByText(/no longer publicly available/)).toBeTruthy()
})
it('Settings requires confirmation and keeps preference and saved-service stores outside library removal', async () => {
  const { wrapper, controller } = setup(); await controller.request(701, true)
  await render(<LibraryManagement />, { wrapper })
  await fireEvent.press(screen.getByText('Remove all library downloads'))
  expect(controller.getSnapshot().items).toHaveLength(1)
  await fireEvent.press(screen.getByText('Remove all library downloads'))
  await waitFor(() => expect(controller.getSnapshot().items).toEqual([]))
})
it('web offers online reading without a Download action or offline promise', async () => {
  const { wrapper } = setup(false)
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Read online')).toBeTruthy())
  expect(screen.queryByText('Download')).toBeNull()
  expect(screen.queryByText('Choose downloads')).toBeNull()
  expect(screen.getByText(/Web supports online reading/)).toBeTruthy()
})

it('Services preserves live scan/session navigation and isolates its error from Library', async () => {
  const { wrapper } = setup(); await render(<Services />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Scan a code' }))
  expect(mockPush).toHaveBeenCalledWith('/scan')
  await fireEvent.press(screen.getByText('Fixture live'))
  expect(mockPush).toHaveBeenCalledWith('/sessions/99/parts')
  await fireEvent.press(screen.getByRole('radio', { name: 'Services, Library' }))
  await waitFor(() => expect(screen.getByText('Browse public liturgies')).toBeTruthy())
  expect(screen.queryByText('fixture offline')).toBeNull()
})

it('Strict Mode effect reattachment keeps the library usable without automatic downloads', async () => {
  const { wrapper: Wrapper, api } = setup()
  await render(<StrictMode><Wrapper><LibraryScreen /></Wrapper></StrictMode>)
  await waitFor(() => expect(screen.getByText('Choose downloads')).toBeTruthy())
  expect(api.bundle).not.toHaveBeenCalled()
})
