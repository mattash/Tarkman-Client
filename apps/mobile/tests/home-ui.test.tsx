import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { colors } from '../design/tokens'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { ServicesProvider } from '../features/home/ServicesProvider'
import { Today } from '../features/home/Today'
import { ServicesList } from '../features/home/ServicesList'
import { Settings } from '../features/home/Settings'
import { TabBar } from '../components/TabBar'
import { normalizeServices } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { useReader } from '../features/live/useReader'
import { LAST_READING_KEY } from '../features/progress/lastReading'
import TabsLayout from '../app/(tabs)/_layout'

const mockPush = jest.fn(), mockNavigate = jest.fn()
const mockAuth = { current: { status: 'signedOut' } as Record<string, unknown> }
const mockStored: Record<string, string> = {}
const mockGetPermission = jest.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>()
const mockRequestPermission = jest.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>()
const mockGetPosition = jest.fn<() => Promise<{ coords: { latitude: number; longitude: number } }>>()

jest.mock('../features/live/useReader')
jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path), navigate: (path: string) => mockNavigate(path) },
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
  Tabs: Object.assign(() => null, { Screen: () => null }),
}))
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetPermission(),
  requestForegroundPermissionsAsync: () => mockRequestPermission(),
  getCurrentPositionAsync: () => mockGetPosition(),
  Accuracy: { Balanced: 3 },
}))
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: mockAuth.current, signOut: jest.fn() }) }))
jest.mock('../features/preferences/storage', () => ({
  preferencesStore: {
    get: async (key: string) => mockStored[key] ?? null,
    set: async (key: string, value: string) => { mockStored[key] = value },
    remove: async (key: string) => { delete mockStored[key] },
  },
}))

const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}>
  <ServicesProvider endpoints={endpoints}>{children}</ServicesProvider>
</PreferencesProvider></ThemeProvider>
const stJohn = { id: 9, church_name: 'St. John Armenian Church', liturgy: 'Divine Liturgy', status: 'active', church_latitude: 37.7509, church_longitude: -122.4477 }
const trinity = { id: 12, church_name: 'Holy Trinity, Cambridge', liturgy: 'Morning Service', status: 'active', church_latitude: 42.3736, church_longitude: -71.1097 }
const retry = jest.fn()
function listing(sessions: object[]) {
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, services: normalizeServices({ sessions: sessions.map(session => ({ session })) }) }, retry, dispatch: jest.fn() })
}

beforeEach(() => {
  jest.clearAllMocks()
  for (const key of Object.keys(mockStored)) delete mockStored[key]
  mockAuth.current = { status: 'signedOut' }
  listing([])
  mockGetPermission.mockResolvedValue({ granted: false, canAskAgain: true })
  mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true })
  mockGetPosition.mockResolvedValue({ coords: { latitude: 37.7509, longitude: -122.4477 } })
})

it('treats nothing live as a quiet fact, not an error', async () => {
  await render(<Today />, { wrapper })
  expect(screen.getByText('No service is live right now.')).toBeOnTheScreen()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  await fireEvent.press(screen.getByTestId('scan-row'))
  expect(mockPush).toHaveBeenCalledWith('/scan')
  // No session ID field, sign-in or gallery on the reader's home screen.
  expect(screen.queryByLabelText('Session ID')).toBeNull()
  expect(screen.queryByText(/sign in/i)).toBeNull()
  expect(screen.queryByText(/gallery/i)).toBeNull()
})

it('offers to continue where this device stopped reading', async () => {
  mockStored[LAST_READING_KEY] = JSON.stringify({ sessionId: 4006, title: 'Divine Liturgy', church: 'St. John Armenian Church', date: null, role: 'priest' })
  await render(<Today />, { wrapper })
  const row = await screen.findByTestId('continue-reading')
  expect(within(row).getByText('stopped at Priest')).toBeOnTheScreen()
  await fireEvent.press(row)
  expect(mockPush).toHaveBeenCalledWith('/sessions/4006/parts')
})

it('leads with a single live service and reads along in one tap', async () => {
  listing([{ ...stJohn, current_part_role: 'priest' }])
  await render(<Today />, { wrapper })
  const lead = screen.getByTestId('lead-service')
  expect(within(lead).getByText('Live now')).toBeOnTheScreen()
  expect(within(lead).getByText('Priest')).toBeOnTheScreen()
  await fireEvent.press(within(lead).getByRole('button', { name: 'Read along' }))
  expect(mockPush).toHaveBeenCalledWith('/sessions/9/parts')
  // A number is never shown, even when the API sends a position.
  expect(screen.queryByText(/\b\d+\b/)).toBeNull()
})

it('drops Now reading until the API publishes the current role', async () => {
  listing([stJohn])
  await render(<Today />, { wrapper })
  expect(screen.queryByTestId('now-reading')).toBeNull()
  expect(within(screen.getByTestId('lead-service')).getByRole('button', { name: 'Read along' })).toBeOnTheScreen()
})

it('does not guess a lead when several services are live and location is unknown', async () => {
  listing([stJohn, trinity])
  await render(<Today />, { wrapper })
  expect(screen.queryByTestId('lead-service')).toBeNull()
  expect(screen.getByText('Live now')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Morning Service, Holy Trinity, Cambridge, live now' })).toBeOnTheScreen()
})

it('asks for location only when the reader taps, then places them at their church', async () => {
  listing([stJohn, trinity])
  await render(<Today />, { wrapper })
  await waitFor(() => expect(mockGetPermission).toHaveBeenCalled())
  expect(mockRequestPermission).not.toHaveBeenCalled()
  expect(mockGetPosition).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Find the church you’re at' }))
  expect(await screen.findByText('You’re at St. John Armenian Church')).toBeOnTheScreen()
  expect(within(screen.getByTestId('lead-service')).getByText('Divine Liturgy')).toBeOnTheScreen()
  expect(screen.getByText('Also live elsewhere')).toBeOnTheScreen()
  expect(mockPush).not.toHaveBeenCalled()
})

it('places a returning reader without prompting when location was already allowed', async () => {
  mockGetPermission.mockResolvedValue({ granted: true, canAskAgain: true })
  listing([stJohn, trinity])
  await render(<Today />, { wrapper })
  expect(await screen.findByText('You’re at St. John Armenian Church')).toBeOnTheScreen()
  expect(mockRequestPermission).not.toHaveBeenCalled()
})

it('withdraws the location offer once it is turned off in Settings', async () => {
  mockGetPermission.mockResolvedValue({ granted: false, canAskAgain: false })
  listing([stJohn, trinity])
  await render(<Today />, { wrapper })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Find the church you’re at' })).toBeNull())
})

it('lists every service on the Services tab', async () => {
  listing([stJohn, trinity])
  await render(<ServicesList />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Morning Service, Holy Trinity, Cambridge, live now' }))
  expect(mockPush).toHaveBeenCalledWith('/sessions/12/parts')
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh services' }))
  expect(retry).toHaveBeenCalled()
})

it('keeps sign-in inside Settings, and My services only when signed in', async () => {
  await render(<Settings />, { wrapper })
  expect(screen.queryByRole('button', { name: /My services/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: /^Sign in/ }))
  expect(mockPush).toHaveBeenCalledWith('/sign-in')
  mockAuth.current = { status: 'signedIn', user: { name: 'Deacon', email: 'deacon@example.test' } }
  await render(<Settings />, { wrapper })
  expect(screen.getByText('Signed in as Deacon')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: /^My services/ }))
  expect(mockPush).toHaveBeenCalledWith('/services')
})

it('keeps at least one reading language in Settings', async () => {
  await render(<Settings />, { wrapper })
  for (const name of ['Русский', 'Գրաբար', 'Translit']) {
    await fireEvent.press(screen.getByRole('checkbox', { name }))
  }
  const remaining = screen.getAllByRole('checkbox').filter(row => row.props.accessibilityState?.checked)
  expect(remaining).toHaveLength(1)
  await fireEvent.press(remaining[0])
  expect(screen.getByText('Keep at least one reading language.')).toBeOnTheScreen()
})

it('labels tabs as a three-item tab list and never truncates the label', async () => {
  const onSelect = jest.fn()
  await render(<TabBar tabs={[{ name: 'index', label: 'Today', icon: 'tab-today' }, { name: 'live', label: 'Services', icon: 'tab-services' },
    { name: 'settings', label: 'Settings', icon: 'tab-settings' }]} selected="index" onSelect={onSelect} />, { wrapper: ({ children }) => <ThemeProvider scheme="light">{children}</ThemeProvider> })
  const today = screen.getByRole('tab', { name: 'Today' })
  expect(today).toHaveProp('accessibilityState', { selected: true })
  expect(today).toHaveProp('accessibilityHint', '1 of 3')
  expect(within(today).getByText('Today')).toHaveStyle({ color: colors.light.primary })
  expect(within(screen.getByRole('tab', { name: 'Services' })).getByText('Services')).toHaveStyle({ color: colors.light.onDisabled })
  expect(within(today).getByText('Today').props.numberOfLines).toBeUndefined()
  await fireEvent.press(screen.getByRole('tab', { name: 'Settings' }))
  expect(onSelect).toHaveBeenCalledWith('settings')
})

it('shows configuration failure without mounting network consumers', async () => {
  const api = process.env.EXPO_PUBLIC_API_URL, cable = process.env.EXPO_PUBLIC_ACTIONCABLE_URL
  delete process.env.EXPO_PUBLIC_API_URL; delete process.env.EXPO_PUBLIC_ACTIONCABLE_URL
  try {
    await render(<TabsLayout />, { wrapper: ({ children }) => <ThemeProvider scheme="light">{children}</ThemeProvider> })
    expect(screen.getByRole('alert')).toHaveTextContent(/not configured/)
    expect(useReader).not.toHaveBeenCalled()
  } finally { if (api !== undefined) process.env.EXPO_PUBLIC_API_URL = api; if (cable !== undefined) process.env.EXPO_PUBLIC_ACTIONCABLE_URL = cable }
})
