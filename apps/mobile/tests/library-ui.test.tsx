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
const mockBack = jest.fn(), mockReplace = jest.fn()
let mockCanGoBack = true
const mockParams: { id: string; environment: string; origin?: string } = { id: '701', environment: 'test', origin: 'library' }
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
it('opening Library and starters transfers nothing; deselect/Skip persists and quiet re-entry remains', async () => {
  const { wrapper, api, controller } = setup(); await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Choose services to save')).toBeTruthy())
  await fireEvent.press(screen.getByText('Choose services to save'))
  expect(api.bundle).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('checkbox'))
  expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false)
  await fireEvent.press(screen.getByText('Skip'))
  await waitFor(() => expect(controller.getSnapshot().dismissed).toBe(true))
  expect(screen.queryByText('Recommended to start')).toBeNull()
  expect(screen.getByText('Choose services to save')).toBeTruthy(); expect(api.bundle).not.toHaveBeenCalled()
})
it('explicit starter confirmation downloads only selected IDs', async () => {
  const { wrapper, api, controller } = setup(); await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Choose services to save')).toBeTruthy())
  await fireEvent.press(screen.getByText('Choose services to save')); await fireEvent.press(screen.getByText('Save selected'))
  await waitFor(() => expect(controller.getSnapshot().items[0]?.bundle).toBeTruthy())
  expect(api.bundle).toHaveBeenCalledTimes(1)
})
it('failed check leaves local saved services reachable', async () => {
  const { wrapper, controller, api } = setup(); await controller.request(701, true)
  api.catalog.mockRejectedValue(new LibraryError('network'))
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText(/Couldn’t check for new texts right now/)).toBeTruthy())
  await fireEvent.press(screen.getByText('Open'))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/liturgies/[id]', params: { id: '701', environment: 'test', origin: 'library' } })
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
  await fireEvent.press(screen.getByText('Remove all saved services'))
  expect(controller.getSnapshot().items).toHaveLength(1)
  await fireEvent.press(screen.getByText('Remove all saved services'))
  await waitFor(() => expect(controller.getSnapshot().items).toEqual([]))
})
it('web offers online reading without a Download action or offline promise', async () => {
  const { wrapper } = setup(false)
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Read now')).toBeTruthy())
  expect(screen.queryByText('Save for offline')).toBeNull()
  expect(screen.queryByText('Choose services to save')).toBeNull()
  expect(screen.getByText(/Read here with an internet connection/)).toBeTruthy()
})

it('Services preserves live scan/session navigation and isolates its error from Library', async () => {
  const { wrapper } = setup(); await render(<Services />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Scan a code' }))
  expect(mockPush).toHaveBeenCalledWith('/scan')
  await fireEvent.press(screen.getByText('Fixture live'))
  expect(mockPush).toHaveBeenCalledWith('/sessions/99/parts')
  await fireEvent.press(screen.getByRole('radio', { name: 'Services, Prayer Library' }))
  await waitFor(() => expect(screen.getByText('All services')).toBeTruthy())
  expect(screen.queryByText('fixture offline')).toBeNull()
})

it('Strict Mode effect reattachment keeps the library usable without automatic downloads', async () => {
  const { wrapper: Wrapper, api } = setup()
  await render(<StrictMode><Wrapper><LibraryScreen /></Wrapper></StrictMode>)
  await waitFor(() => expect(screen.getByText('Choose services to save')).toBeTruthy())
  expect(api.bundle).not.toHaveBeenCalled()
})

it('All/Saved filters one list, keeps service names, and offers a single primary action per state', async () => {
  const { wrapper, controller } = setup()
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Save for offline')).toBeTruthy())
  expect(screen.getByText('Keep the services you pray with close at hand.')).toBeTruthy()
  expect(screen.getByPlaceholderText('Search services')).toBeTruthy()
  expect(screen.queryByText('Not downloaded')).toBeNull()
  expect(screen.queryByText('Stop saving')).toBeNull()
  await fireEvent.press(screen.getByRole('radio', { name: 'Show services, Saved' }))
  expect(screen.getByText('Nothing saved yet.')).toBeTruthy()
  expect(screen.getByText('Save a service here and you can pray with it anywhere — even without a signal.')).toBeTruthy()
  expect(screen.queryByText(fixture.liturgy.name)).toBeNull()
  await fireEvent.press(screen.getByRole('radio', { name: 'Show services, All' }))
  await fireEvent.press(screen.getByText('Save for offline'))
  await waitFor(() => expect(screen.getByText('Available offline')).toBeTruthy())
  expect(screen.getAllByText(fixture.liturgy.name)).toHaveLength(1)
  expect(screen.queryByText('Not downloaded')).toBeNull()
  expect(screen.getByText('Open')).toBeTruthy()
  expect(screen.queryByText('Update')).toBeNull()
  expect(controller.getSnapshot().items[0].bundle).toBeTruthy()
  await fireEvent.changeText(screen.getByPlaceholderText('Search services'), 'no match')
  expect(screen.getByText('No services match your search.')).toBeTruthy()
})
it('updated text and failed updates preserve Open and explain that the saved version remains', async () => {
  const { wrapper, controller, api } = setup()
  await controller.request(701, true)
  api.catalog.mockResolvedValue({ ...parseCatalog(catalog), liturgies: parseCatalog(catalog).liturgies.map(item => ({ ...item, revision: changed.revision })) })
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Updated text available')).toBeTruthy())
  api.bundle.mockRejectedValue(new LibraryError('network'))
  await fireEvent.press(screen.getByText('Update'))
  await waitFor(() => expect(screen.getByText('Couldn’t update right now. You can keep reading the version you have.')).toBeTruthy())
  expect(screen.getByText('Open')).toBeTruthy()
  expect(controller.getSnapshot().items[0].bundle?.revision).toBe(fixture.revision)
})
it('save failures are humane and saved-only filtering excludes incomplete saves', async () => {
  const { wrapper, api } = setup()
  api.bundle.mockRejectedValue(new LibraryError('network'))
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Save for offline')).toBeTruthy())
  await fireEvent.press(screen.getByText('Save for offline'))
  await waitFor(() => expect(screen.getByText('This service didn’t finish saving. Try again when you’re connected.')).toBeTruthy())
  await fireEvent.press(screen.getByRole('radio', { name: 'Show services, Saved' }))
  expect(screen.getByText('Nothing saved yet.')).toBeTruthy()
})
it.each<['size' | 'invalid', string]>([
  ['size', 'This service is too large to save.'],
  ['invalid', 'This service couldn’t be saved because its content could not be validated.'],
])('%s save failures explain the reason without suggesting reconnection', async (code, message) => {
  const { wrapper, controller, api } = setup()
  api.bundle.mockRejectedValue(new LibraryError(code))
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Save for offline')).toBeTruthy())
  await fireEvent.press(screen.getByText('Save for offline'))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
  expect(screen.getByRole('alert')).not.toHaveTextContent(/connected|saved version/)
  expect(screen.queryByText('Open')).toBeNull()
  expect(controller.getSnapshot().items[0].bundle).toBeNull()
})
it.each<['size' | 'invalid', string]>([
  ['size', 'This service is too large to save.'],
  ['invalid', 'This service couldn’t be saved because its content could not be validated.'],
])('%s update failures explain the reason and keep the saved revision available through Open', async (code, message) => {
  const { wrapper, controller, api, store } = setup()
  await controller.request(701, true)
  api.catalog.mockResolvedValue({ ...parseCatalog(catalog), liturgies: parseCatalog(catalog).liturgies.map(item => ({ ...item, revision: changed.revision })) })
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Updated text available')).toBeTruthy())
  api.bundle.mockRejectedValue(new LibraryError(code))
  await fireEvent.press(screen.getByText('Update'))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(`${message} You can still choose Open to read your saved version.`))
  expect(screen.getByRole('alert')).not.toHaveTextContent(/connected/)
  expect(screen.getByRole('button', { name: 'Open' }).props.accessibilityState.disabled).toBe(false)
  await fireEvent.press(screen.getByText('Open'))
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/liturgies/[id]', params: { id: '701', environment: 'test', origin: 'library' } })
  expect(controller.getSnapshot().items[0].bundle?.revision).toBe(fixture.revision)
  expect(store.rows.get('test:701')?.bundle?.revision).toBe(fixture.revision)
})
it('failed removal remains visible offline and retains the saved copy', async () => {
  const { wrapper, controller, store } = setup()
  await controller.request(701, true)
  store.remove = async () => { throw new Error('SQLite removal failed') }
  mockNetwork.isConnected = false
  try {
    await render(<LibraryScreen />, { wrapper })
    await waitFor(() => expect(controller.getSnapshot().checkedAt).not.toBeNull())
    expect(screen.getByText(/You’re offline/)).toBeTruthy()
    await fireEvent.press(screen.getByText('Remove saved service'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save changes on this device. Please try again.'))
    expect(screen.getByText('Open')).toBeTruthy()
    expect(controller.getSnapshot().items[0].bundle?.revision).toBe(fixture.revision)
  } finally { mockNetwork.isConnected = true }
})
it.each(['network', 'invalid', 'size', 'capacity', 'unsupported', 'cancelled', 'unavailable', 'storage'] as const)('known offline only suppresses a redundant network check error: %s', async code => {
  const { wrapper, controller, api } = setup()
  api.catalog.mockRejectedValue(new LibraryError(code))
  mockNetwork.isConnected = false
  try {
    await render(<LibraryScreen />, { wrapper })
    await waitFor(() => expect(controller.getSnapshot().error).toBe(code))
    expect(screen.getByText(/You’re offline/)).toBeTruthy()
    expect(screen.queryByText(/Couldn’t check for new texts right now/)).toBeNull()
    if (code === 'network') expect(screen.queryByRole('alert')).toBeNull()
    else expect(screen.getByRole('alert')).toBeTruthy()
  } finally { mockNetwork.isConnected = true }
})
it('known offline disables online actions but keeps saved reading available', async () => {
  const { wrapper, controller } = setup()
  await controller.request(701, true)
  mockNetwork.isConnected = false
  try {
    await render(<LibraryScreen />, { wrapper })
    await waitFor(() => expect(screen.getByText('You’re offline. Saved services are ready; the rest will appear when you’re connected.')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Open' }).props.accessibilityState.disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Check for new texts' }).props.accessibilityState.disabled).toBe(true)
  } finally { mockNetwork.isConnected = true }
})
it('reader preserves live language labels/order and explains calendar variables', async () => {
  const { wrapper, controller } = setup()
  await controller.request(701, true)
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
  const labels = screen.getAllByRole('radio').filter(node => node.props.accessibilityLabel.startsWith('Reading languages,')).map(node => node.props.accessibilityLabel)
  expect(labels).toEqual(['Reading languages, English', 'Reading languages, Գրաբար', 'Reading languages, Translit'])
  expect(screen.getAllByText('This part changes according to the church calendar.').length).toBeGreaterThan(0)
})

it('Stop saving is contextual and cancels an active save', async () => {
  const { wrapper, controller, api } = setup()
  let finish!: (bundle: ReturnType<typeof parseBundle>) => void
  api.bundle.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('Save for offline')).toBeTruthy())
  await fireEvent.press(screen.getByText('Save for offline'))
  await waitFor(() => expect(screen.getByText('Stop saving')).toBeTruthy())
  expect(screen.getByRole('button', { name: 'Save for offline' }).props.accessibilityState.busy).toBe(true)
  await fireEvent.press(screen.getByText('Stop saving'))
  await act(async () => { finish(parseBundle(fixture)) })
  expect(screen.queryByText('Stop saving')).toBeNull()
  expect(controller.getSnapshot().items.some(item => item.bundle)).toBe(false)
})
it('Read now uses the reader without saving and Library back returns to its actual origin', async () => {
  const { wrapper, controller, api } = setup()
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
  expect(api.bundle).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().items).toHaveLength(0)
  await fireEvent.press(screen.getByRole('button', { name: /Prayer Library/ }))
  expect(mockBack).toHaveBeenCalled()
})
it('a reader without navigation history labels its Services fallback truthfully', async () => {
  mockCanGoBack = false
  try {
    const { wrapper } = setup()
    await render(<LiturgyReader />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('library-reader')).toBeTruthy())
    await fireEvent.press(screen.getByRole('button', { name: /Services/ }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/live')
  } finally { mockCanGoBack = true }
})

it('successful empty All is distinct from an unavailable capability', async () => {
  const { wrapper, api } = setup()
  api.catalog.mockResolvedValue({ schema_version: 1, liturgies: [], next_after_id: null })
  await render(<LibraryScreen />, { wrapper })
  await waitFor(() => expect(screen.getByText('No services are available yet.')).toBeTruthy())
  expect(screen.queryByText('Nothing saved yet.')).toBeNull()
})
it('known offline disables Read now and Save for offline for an unsaved service', async () => {
  mockNetwork.isConnected = false
  try {
    const { wrapper } = setup()
    await render(<LibraryScreen />, { wrapper })
    await waitFor(() => expect(screen.getByText('Save for offline')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Read now' }).props.accessibilityState.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Save for offline' }).props.accessibilityState.disabled).toBe(true)
  } finally { mockNetwork.isConnected = true }
})

it('reader reuses Русский and the live reader’s selected language order', async () => {
  const { wrapper, controller } = setup(true, { ...preferences, get: async () => JSON.stringify({ language: 'ru', selectedLanguages: ['ru', 'grabar', 'translit'], readingSize: 'standard', appearance: 'system', interfaceLanguage: 'en' }) })
  await controller.request(701, true)
  await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Reading languages, Русский' })).toBeTruthy())
  expect(screen.getAllByRole('radio').filter(node => node.props.accessibilityLabel.startsWith('Reading languages,')).map(node => node.props.accessibilityLabel)).toEqual(['Reading languages, Русский', 'Reading languages, Գրաբար', 'Reading languages, Translit'])
})
