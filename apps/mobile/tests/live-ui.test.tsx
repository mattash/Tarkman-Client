import * as ReactNative from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { SessionReader } from '../features/live/SessionReader'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
jest.mock('../features/live/useReader')
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
const preferencesStore = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider><PreferencesProvider store={preferencesStore}>{children}</PreferencesProvider></ThemeProvider>
const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const retry = jest.fn(), dispatch = jest.fn()
beforeEach(() => { jest.clearAllMocks(); jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false }, retry, dispatch }) })
it('hides Return to live while automatically following', async () => {
  const back = jest.fn()
  await render(<SessionReader endpoints={endpoints} id={7} back={back} />, { wrapper })
  expect(screen.queryByRole('button', { name: 'Return to live' })).toBeNull()
  await fireEvent.press(within(screen.getByTestId('reader-header-actions')).getByRole('button', { name: 'All services' }))
  expect(back).toHaveBeenCalledTimes(1)
})
it('offers Return to live in manual state and resumes following with a refresh', async () => {
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  const button = screen.getByRole('button', { name: 'Return to live' })
  expect(button).toBeOnTheScreen()
  expect(button).toHaveProp('accessibilityHint', 'Resumes automatically following the current part.')
  expect(button).toHaveStyle({ minHeight: 48, minWidth: 48 })
  await fireEvent.press(button)
  expect(dispatch).toHaveBeenCalledWith({ type: 'follow' })
  expect(retry).toHaveBeenCalledTimes(1)
  expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(retry.mock.invocationCallOrder[0])
})
it('keeps recovery and secondary actions reachable outside long scrolling details', async () => {
  const session = normalizeSession({ session: { id: 7, liturgy: 'Long service title '.repeat(100), status: 'paused', status_message: 'Long status message '.repeat(100) } })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, following: false, session }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  const actions = screen.getByTestId('reader-header-actions')
  expect(within(actions).getByRole('button', { name: 'All services' })).toBeOnTheScreen()
  for (const name of ['Choose reading language', 'Explain current part', 'Reading preferences']) expect(within(actions).getByRole('button', { name })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'More reading options' })).toBeNull()
  expect(within(actions).queryByRole('button', { name: 'Return to live' })).toBeNull()
  expect(within(screen.getByTestId('return-to-live')).getByRole('button', { name: 'Return to live' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Choose reading language' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Reading preferences' })).toBeOnTheScreen()
})
it('renders current occurrence, switches language and dismisses explanation sheet', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'English prayer', ru: 'Молитва', grabar: 'Հայր մեր', role: 'Choir' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getByRole('button', { name: 'Choir, current part' })).toBeOnTheScreen()
  expect(screen.getByText('NOW')).toBeOnTheScreen()
  expect(screen.queryByText('Молитва')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Choose reading language' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Русский' }))
  expect(screen.getByText('Молитва')).toBeOnTheScreen()
  expect(screen.queryByText('English prayer')).toBeNull()
  expect(dispatch).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Explain current part' }))
  expect(screen.getByText('No explanation is available for this part.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Close Explanation' }))
  expect(screen.queryByText('No explanation is available for this part.')).toBeNull()
})

it('drafts selected languages, enforces one, and falls back in stable order', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'English prayer', ru: 'Молитва', grabar: 'Հայր մեր', translit: 'Hayr mer', role: 'Choir' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Choose reading language' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Choose languages' }))
  for (const label of ['English', 'Русский', 'Գրաբար', 'Translit']) await fireEvent.press(screen.getByRole('checkbox', { name: label }))
  await fireEvent.press(screen.getByRole('button', { name: 'Apply languages' }))
  expect(screen.getByRole('alert', { name: 'Keep at least one reading language.' })).toHaveTextContent('Keep at least one reading language.')
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Русский' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Apply languages' }))
  expect(screen.getByText('Молитва')).toBeOnTheScreen()
  expect(screen.queryByText('English prayer')).toBeNull()
  expect(dispatch).not.toHaveBeenCalled()
})

it('keeps service and connection states separate and offers recovery without hiding text', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer', status: 'paused' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'Prayer kept while reconnecting', role: 'priest' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, session, parts }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getByLabelText('Service paused. Text stays where it is.')).toBeOnTheScreen()
  expect(screen.getByLabelText('Reconnecting. Connection interrupted. Reading may be out of date.')).toBeOnTheScreen()
  expect(screen.getByText('Prayer kept while reconnecting')).toBeOnTheScreen()
  expect(screen.getByText('PAUSED HERE')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Live. Following the service')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Retry connection' }))
  expect(retry).toHaveBeenCalledTimes(1)
})
it('offers only selected available translations and preserves manual mode when switching', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: null, ru: 'Молитва', grabar: 'Հայր մեր', role: 'priest' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, connected: true, session, parts, following: false }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getByText('Translation not available.')).toBeOnTheScreen()
  expect(screen.queryByText('Молитва')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Read in Translit' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Read in Русский' }))
  expect(screen.getByText('Молитва')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Return to live' })).toBeOnTheScreen()
  expect(dispatch).not.toHaveBeenCalled()
})
it('omits the switch prompt when no selected language has this part, and names languages as shown', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [
    { part: { id: 1, en: null, role: 'priest' } },
    { part: { id: 2, en: null, grabar: 'Հայր մեր', role: 'deacon' } },
  ] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, connected: true, session, parts }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getAllByText('Translation not available.')).toHaveLength(2)
  // Only the deacon part has an alternative, so the prompt appears once.
  expect(screen.getAllByText('Choose another reading language for this part.')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Read in Գրաբար' })).toHaveTextContent('Read in Գրաբար')
})
it('keeps the steady Live indicator out of live announcements and anchors reading content', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'Prayer', role: 'priest' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, connected: true, listed: true, session, parts }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  expect(screen.getByLabelText('Live')).toHaveProp('accessibilityLiveRegion', 'none')
  expect(screen.getByRole('button', { name: 'priest, current part' })).toBeOnTheScreen()
  expect(screen.getByTestId('reading-list')).toHaveProp('maintainVisibleContentPosition', { minIndexForVisible: 1 }) // header + first part
})
it('previews larger text and asks before resetting reading choices', async () => {
  const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'Current prayer preview', role: 'priest' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, connected: true, session, parts }, retry, dispatch })
  await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Reading preferences' }))
  await fireEvent.press(screen.getByRole('radio', { name: 'Reading size, Larger' }))
  const modal = within(screen.getByTestId('modal-content'))
  expect(modal.getByText('Current prayer preview')).toHaveStyle({ fontSize: 30, lineHeight: 46 })
  await fireEvent.press(screen.getByRole('button', { name: 'Forget my reading choices' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Keep my choices' }))
  expect(screen.getByRole('radio', { name: 'Reading size, Larger' }).props.accessibilityState.selected).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: 'Forget my reading choices' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Reset reading choices' }))
  expect(screen.getByText('Current prayer preview')).toHaveStyle({ fontSize: 24, lineHeight: 38 })
})

it.each([
  { width: 402, height: 874, fontScale: 1 },
  { width: 874, height: 402, fontScale: 1 },
  { width: 320, height: 568, fontScale: 3.12 },
])('keeps all reader controls and live status in the header at $width × $height, scale $fontScale', async dimensions => {
  const viewport = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ ...dimensions, scale: 1 })
  try {
    const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Service title' } })
    const parts = normalizeParts({ parts: [{ part: { id: 1, en: 'Prayer', role: 'priest' } }] })
    const state = { ...initialState, loading: false, stale: false, connected: true, session, parts }
    jest.mocked(useReader).mockReturnValue({ state, retry, dispatch })
    const view = await render(<SessionReader endpoints={endpoints} id={7} back={() => {}} />, { wrapper })
    for (const following of [true, false]) {
      jest.mocked(useReader).mockReturnValue({ state: { ...state, following }, retry, dispatch })
      await view.rerender(<SessionReader endpoints={endpoints} id={7} back={() => {}} />)
      const header = within(screen.getByTestId('reader-header-actions'))
      expect(header.getByLabelText('Live')).toBeOnTheScreen()
      for (const name of ['All services', 'Choose reading language', 'Explain current part', 'Reading preferences']) {
        expect(header.getByRole('button', { name })).toBeOnTheScreen()
      }
      expect(header.queryByText('Service title')).toBeNull()
      expect(screen.queryByRole('button', { name: 'More reading options' })).toBeNull()
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Explain current part' }))
    expect(screen.getByText('No explanation is available for this part.')).toBeOnTheScreen()
  } finally { viewport.mockRestore() }
})
