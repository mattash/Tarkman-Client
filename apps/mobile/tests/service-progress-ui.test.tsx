import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { I18nProvider } from '../features/i18n'
import SessionReaderScreen from '../app/sessions/[id]/parts'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { isServiceProgressAvailable, presentServiceProgress } from '../features/service-progress/native'

jest.mock('../features/live/useReader')
jest.mock('../features/service-progress/native')
let mockReaderAPI = 'https://reader.example.test'
jest.mock('../features/live/config', () => ({ readerConfig: () => ({ endpoints: { api: mockReaderAPI, cable: 'wss://reader.example.test/cable' } }) }))
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }))
let mockSelectedID = '42'
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockSelectedID }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
}))
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: () => () => {} } }))
const store = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <GestureHandlerRootView><ThemeProvider><PreferencesProvider store={store}><I18nProvider preference="en">{children}</I18nProvider></PreferencesProvider></ThemeProvider></GestureHandlerRootView>
const dispatch = jest.fn(), retry = jest.fn()
const label = 'Service progress options'

beforeEach(() => {
  jest.clearAllMocks()
  mockSelectedID = '42'
  mockReaderAPI = 'https://reader.example.test'
  jest.mocked(isServiceProgressAvailable).mockReturnValue(true)
  jest.mocked(presentServiceProgress).mockResolvedValue('presented')
  // Deliberately different response ID: presentation must use the selected public route, not a payload.
  const session = normalizeSession({ session: { id: 999, liturgy: 'Public service', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'Public prayer remains readable', role: 'Choir' } }] })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, following: false, session, parts }, retry, dispatch, refreshAfterCommand: jest.fn() })
})

it('opens only on one explicit tap using the selected public service and configured reader origin', async () => {
  await render(<SessionReaderScreen />, { wrapper })
  expect(screen.getByText('Public prayer remains readable')).toBeOnTheScreen()
  expect(presentServiceProgress).not.toHaveBeenCalled()
  expect(dispatch).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: label })
  expect(button).toHaveProp('accessibilityHint', 'Opens options for this service. Opening does not start a Live Activity.')
  await fireEvent.press(button)
  expect(presentServiceProgress).toHaveBeenCalledTimes(1)
  expect(presentServiceProgress).toHaveBeenCalledWith(42, 'https://reader.example.test')
  expect(dispatch).not.toHaveBeenCalled()
  expect(retry).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Return to live' })).toBeOnTheScreen()
})

it('accepts a configured bare root with a trailing slash', async () => {
  mockReaderAPI = 'https://reader.example.test/'
  await render(<SessionReaderScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(presentServiceProgress).toHaveBeenCalledWith(42, 'https://reader.example.test')
})

it.each([
  'https://reader.example.test/api/v1',
  'https://reader.example.test/?private=value',
  'https://reader.example.test/#private',
  'https://private:secret@reader.example.test',
  'invalid-config',
])('fails closed for non-root or unsafe reader config %s without disrupting reading', async api => {
  mockReaderAPI = api
  await render(<SessionReaderScreen />, { wrapper })
  expect(presentServiceProgress).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(presentServiceProgress).not.toHaveBeenCalled()
  expect(screen.getByRole('alert', { name: /service progress options/i })).toHaveTextContent('Service progress options are unavailable right now. You can keep reading here.')
  expect(screen.getByText('Public prayer remains readable')).toBeOnTheScreen()
  expect(screen.queryByText(/private|secret|invalid-config/)).toBeNull()
  expect(useReader).toHaveBeenCalledWith(expect.objectContaining({ api }), 42)
  expect(dispatch).not.toHaveBeenCalled()
  expect(retry).not.toHaveBeenCalled()
})

it('uses the newly selected service after navigation without automatic presentation', async () => {
  const view = await render(<SessionReaderScreen />, { wrapper })
  mockSelectedID = '73'
  await view.rerender(<SessionReaderScreen />)
  expect(presentServiceProgress).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(presentServiceProgress).toHaveBeenCalledWith(73, 'https://reader.example.test')
})

it('prevents duplicate presentation while a tap is pending', async () => {
  let finish!: (value: 'presented') => void
  jest.mocked(presentServiceProgress).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await render(<SessionReaderScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(screen.getByRole('button', { name: label })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(presentServiceProgress).toHaveBeenCalledTimes(1)
  await act(async () => { finish('presented') })
  expect(screen.getByRole('button', { name: label })).not.toBeDisabled()
})

it('omits an absent or unsupported facade without disrupting normal public reading', async () => {
  // Facade owns product-off, web, Android, missing-module and unsupported-OS admission.
  jest.mocked(isServiceProgressAvailable).mockReturnValue(false)
  await render(<SessionReaderScreen />, { wrapper })
  expect(screen.queryByRole('button', { name: label })).toBeNull()
  expect(screen.getByText('Public prayer remains readable')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Return to live' }))
  expect(dispatch).toHaveBeenCalledWith({ type: 'follow' })
  expect(retry).toHaveBeenCalledTimes(1)
  expect(presentServiceProgress).not.toHaveBeenCalled()
})

it.each(['unavailable', 'unsupported', 'failed'] as const)('shows sanitized %s feedback without changing the reader', async result => {
  jest.mocked(presentServiceProgress).mockResolvedValue(result)
  await render(<SessionReaderScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(screen.getByRole('alert', { name: /service progress options/i })).toHaveTextContent(result === 'failed'
    ? 'Could not open service progress options. Try again or keep reading here.'
    : 'Service progress options are unavailable right now. You can keep reading here.')
  expect(screen.getByText('Public prayer remains readable')).toBeOnTheScreen()
  expect(dispatch).not.toHaveBeenCalled()
  expect(retry).not.toHaveBeenCalled()
})

it('never renders raw rejected errors and allows another explicit attempt', async () => {
  jest.mocked(presentServiceProgress).mockRejectedValueOnce(new Error('private token https://secret.example.test'))
  await render(<SessionReaderScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(screen.getByRole('alert', { name: /service progress options/i })).toHaveTextContent('Could not open service progress options. Try again or keep reading here.')
  expect(screen.queryByText(/private token|secret\.example/)).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: label }))
  expect(presentServiceProgress).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert', { name: /service progress options/i })).toBeNull()
  expect(dispatch).not.toHaveBeenCalled()
})

it('renders accessible Russian app copy', async () => {
  await render(<I18nProvider preference="ru"><SessionReaderScreen /></I18nProvider>, { wrapper })
  const button = screen.getByRole('button', { name: 'Параметры хода службы' })
  expect(button).toHaveProp('accessibilityHint', 'Открывает параметры этой службы. Открытие не запускает Live Activity.')
  jest.mocked(presentServiceProgress).mockResolvedValue('unavailable')
  await fireEvent.press(button)
  expect(screen.getByRole('alert', { name: /Параметры хода службы/ })).toHaveTextContent('Параметры хода службы сейчас недоступны. Вы можете продолжить чтение здесь.')
})
