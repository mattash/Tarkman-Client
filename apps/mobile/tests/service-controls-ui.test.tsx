import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { useReader } from '../features/live/useReader'
import ServiceControlScreen from '../app/(signed-in)/services/[id]'
import { deferred, respond } from './auth-helpers'

jest.mock('../features/live/useReader')
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (callback: (active: boolean, online: boolean) => void) => { callback(true, true); return () => {} } } }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false }, useLocalSearchParams: () => ({ id: '9' }) }))

const mockAuthorizedFetch = jest.fn<(path: string, init?: { method?: string; body?: string }) => Promise<Response>>()
jest.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({ authorizedFetch: (path: string, init?: { method?: string; body?: string }) => mockAuthorizedFetch(path, init) }),
  isUnauthorized: () => false,
}))

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', status: 'active', current_part_id: 1 } })
const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } }, { part: { id: 2, position: 2, role: 'Deacon', en: 'Let us beseech the Lord.' } }] })
const retry = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.EXPO_PUBLIC_API_URL = 'https://example.test'
  process.env.EXPO_PUBLIC_ACTIONCABLE_URL = 'wss://example.test/cable'
  mockAuthorizedFetch.mockResolvedValue(respond(200, { status: 'ok' }))
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts }, retry, dispatch: jest.fn() })
})

const sent = () => mockAuthorizedFetch.mock.calls.map(call => `${call[1]?.method} ${call[0]}`)

it('moves the service forward and back, and jumps to a chosen part', async () => {
  await render(<ServiceControlScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  await waitFor(() => expect(retry).toHaveBeenCalled())
  await fireEvent.press(screen.getByRole('button', { name: 'Previous part' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Go to part 2' }))
  expect(sent()).toEqual(['POST /s/9/next.json', 'POST /s/9/prev.json', 'POST /s/9/set_part.json'])
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[0][1]?.body))).toMatchObject({ expected_part_id: 1 })
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[2][1]?.body))).toMatchObject({ part_id: 2, expected_part_id: 1 })
  expect(screen.getByRole('button', { name: 'Go to part 1' })).toBeDisabled()
})

it('changes what the congregation sees, including a custom announcement', async () => {
  await render(<ServiceControlScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Paused' }))
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[0][1]?.body))).toEqual({ status: 'paused' })
  await fireEvent.changeText(screen.getByLabelText('Message'), '  Coffee hour follows  ')
  await fireEvent.press(screen.getByRole('button', { name: 'Show this message' }))
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[1][1]?.body))).toEqual({ status: 'showing_custom', status_message: 'Coffee hour follows' })
})

it('locks every control while a command is running', async () => {
  const slow = deferred<Response>()
  mockAuthorizedFetch.mockReturnValueOnce(slow.promise)
  await render(<ServiceControlScreen />, { wrapper })
  void fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  await waitFor(() => expect(mockAuthorizedFetch).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previous part' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'Paused' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Go to part 2' })).toBeDisabled()
  slow.resolve(respond(200, {}))
  await waitFor(() => expect(retry).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previous part' })).not.toBeDisabled())
})

it('reports a refused command and leaves the service alone', async () => {
  mockAuthorizedFetch.mockResolvedValueOnce(respond(403, {}))
  await render(<ServiceControlScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  expect(await screen.findByText('You do not have permission to control this service.')).toBeOnTheScreen()
  expect(retry).not.toHaveBeenCalled()
})
