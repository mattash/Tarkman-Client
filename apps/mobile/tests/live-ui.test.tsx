import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { Discovery } from '../features/live/Discovery'
import { SessionReader } from '../features/live/SessionReader'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import LiveScreen from '../app/index'
jest.mock('../features/live/useReader')
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>
const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const retry = jest.fn(), dispatch = jest.fn()
beforeEach(() => { jest.clearAllMocks(); jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false }, retry, dispatch }) })
it('shows configuration failure without mounting network consumers', async () => {
  const api = process.env.EXPO_PUBLIC_API_URL, cable = process.env.EXPO_PUBLIC_ACTIONCABLE_URL
  delete process.env.EXPO_PUBLIC_API_URL; delete process.env.EXPO_PUBLIC_ACTIONCABLE_URL
  try { await render(<LiveScreen />, { wrapper }); expect(screen.getByRole('alert')).toHaveTextContent(/not configured/); expect(useReader).not.toHaveBeenCalled() }
  finally { if (api !== undefined) process.env.EXPO_PUBLIC_API_URL = api; if (cable !== undefined) process.env.EXPO_PUBLIC_ACTIONCABLE_URL = cable }
})
it('offers empty discovery, retry and validated session-ID entry', async () => {
  const open = jest.fn()
  await render(<Discovery endpoints={endpoints} open={open} />, { wrapper })
  expect(screen.getByText('No live service right now')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Open session' }))
  expect(open).not.toHaveBeenCalled(); expect(screen.getByText('Enter a valid numeric session ID.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Session ID'), '7')
  await fireEvent(screen.getByLabelText('Session ID'), 'submitEditing')
  expect(open).toHaveBeenCalledWith(7)
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh services' })); expect(retry).toHaveBeenCalled()
})
it('shows recoverable errors without presenting failed discovery as empty', async () => {
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, error: 'Could not refresh.' }, retry, dispatch })
  await render(<Discovery endpoints={endpoints} open={() => {}} />, { wrapper })
  expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh.')
  expect(screen.queryByText('No live service right now')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Retry connection' })); expect(retry).toHaveBeenCalled()
})
it('hides Return to live while automatically following', async () => {
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.queryByRole('button', { name: 'Return to live' })).toBeNull()
})
it('offers Return to live in manual state and resumes following with a refresh', async () => {
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  const button = screen.getByRole('button', { name: 'Return to live' })
  expect(button).toBeOnTheScreen()
  expect(button).toHaveProp('accessibilityHint', 'Resumes automatically following the current part.')
  await fireEvent.press(button)
  expect(dispatch).toHaveBeenCalledWith({ type: 'follow' })
  expect(retry).toHaveBeenCalledTimes(1)
})
it('renders current occurrence, switches language and dismisses explanation sheet', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'English prayer', ru: 'Молитва', grabar: 'Հայր մեր', role: 'Choir' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getByText('1 / Choir · Current part')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Choose reading language' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Русский' }))
  expect(screen.getByText('Молитва')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Explain current part' }))
  expect(screen.getByText('No explanation is available for this part.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Close Current part explanation' }))
  expect(screen.queryByText('No explanation is available for this part.')).toBeNull()
})
