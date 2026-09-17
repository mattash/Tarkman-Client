import { beforeEach, expect, it, jest } from '@jest/globals'
import { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { initialState, type ReaderState } from '../features/live/state'
import { useReader } from '../features/live/useReader'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import ServiceControlScreen from '../app/(signed-in)/services/[id]/index'
import ServiceSheet from '../app/(signed-in)/services/[id]/service'
import ControlLanguagesSheet from '../app/(signed-in)/services/[id]/languages'
import { ServiceControlProvider } from '../features/services/ServiceControlProvider'
import { deferred, respond } from './auth-helpers'

jest.mock('../features/live/useReader')
let mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 }
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWindow }))
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (callback: (active: boolean, online: boolean) => void) => { callback(true, (globalThis as { __online?: boolean }).__online ?? true); return () => {} } } }))
// The Service sheet is a native form-sheet route; here pushing it mounts the sheet beside the screen and going back removes it.
const mockSheet: { open(open: boolean): void } = { open: () => {} }
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ router: {
  push: () => mockSheet.open(true), back: () => { mockBack(); mockSheet.open(false) }, replace: jest.fn(), canGoBack: () => false,
}, useLocalSearchParams: () => ({ id: '9' }) }))

const mockAuthorizedFetch = jest.fn<(path: string, init?: { method?: string; body?: string }) => Promise<Response>>()
jest.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({ authorizedFetch: (path: string, init?: { method?: string; body?: string }) => mockAuthorizedFetch(path, init) }),
  isUnauthorized: () => false,
}))

let mockStored: string | null = null
const preferences = { get: async () => mockStored, set: async (_key: string, value: string) => { mockStored = value }, remove: async () => { mockStored = null } }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}>{children}</PreferencesProvider></ThemeProvider>
const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', status: 'active', current_part_id: 1 } })
const parts = normalizeParts({ parts: [
  { part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.', grabar: 'Տէր, ողորմեա։' } },
  { part: { id: 2, position: 2, role: 'Deacon', posture: 'stand', en: 'Let us beseech the Lord.' } },
] })
const retry = jest.fn()
const reader = (overrides: Partial<ReaderState> = {}) => ({ saved: null, state: { ...initialState, loading: false, stale: false, connected: true, session, parts, updatedAt: 1, ...overrides }, retry, refreshAfterCommand: retry, dispatch: jest.fn() })

beforeEach(() => {
  jest.clearAllMocks()
  ;(globalThis as { __online?: boolean }).__online = true
  process.env.EXPO_PUBLIC_API_URL = 'https://example.test'
  process.env.EXPO_PUBLIC_ACTIONCABLE_URL = 'wss://example.test/cable'
  mockAuthorizedFetch.mockResolvedValue(respond(200, { status: 'ok' }))
  jest.mocked(useReader).mockReturnValue(reader())
  // A phone unless a test says otherwise; the test renderer's default window is wider than the two-pane breakpoint.
  mockWindow = { width: 402, height: 874, scale: 3, fontScale: 1 }
  mockStored = null
})

function Control() {
  const [sheet, setSheet] = useState(false)
  useEffect(() => { mockSheet.open = setSheet }, [])
  return <ServiceControlProvider sessionId={9}><ServiceControlScreen />{sheet && <ServiceSheet />}</ServiceControlProvider>
}

const sent = () => mockAuthorizedFetch.mock.calls.map(call => `${call[1]?.method} ${call[0]}`)

it('shows the full current part at reading size, with its position, for the operator to read aloud', async () => {
  await render(<Control />, { wrapper })
  expect(screen.getByText('ON NOW')).toBeOnTheScreen()
  expect(screen.getByTestId('control-position')).toHaveTextContent('1 of 2')
  expect(screen.getByText('Lord, have mercy.')).toBeOnTheScreen()
  // Until the operator arranges their own, control reads from the reading language with Grabar beneath it as a gloss.
  expect(screen.getAllByTestId(/^control-text-/).map(node => node.props.testID)).toEqual(['control-text-en', 'control-text-grabar'])
  expect(screen.getByText('Տէր, ողորմեա։')).toBeOnTheScreen()
  expect(screen.getByText('Next up · Deacon')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Next part' }).props.accessibilityHint).toBe('Moves the service to Deacon.')
  expect(screen.getByRole('button', { name: 'Service' }).props.accessibilityHint).toBe('Status, announcements and jumping to a part.')
  // Status lives in the sheet, not on the page.
  expect(screen.queryByRole('button', { name: 'Paused' })).toBeNull()
})

it('moves the service forward and back, and jumps to a chosen part from the sheet', async () => {
  const view = await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  await waitFor(() => expect(retry).toHaveBeenCalled())
  // The move landed on part 2, where Back becomes available again.
  const moved = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', status: 'active', current_part_id: 2 } })
  jest.mocked(useReader).mockReturnValue(reader({ session: moved }))
  await view.rerender(<Control />)
  await fireEvent.press(screen.getByRole('button', { name: 'Previous part' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  // Next and Back are never in the sheet.
  expect(screen.getAllByRole('button', { name: 'Next part' })).toHaveLength(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Go to another part' }))
  expect(screen.getByRole('button', { name: 'Go to part 2' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Go to part 1' }))
  expect(sent()).toEqual(['POST /s/9/next.json', 'POST /s/9/prev.json', 'POST /s/9/set_part.json'])
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[0][1]?.body))).toMatchObject({ expected_part_id: 1 })
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[2][1]?.body))).toMatchObject({ part_id: 1, expected_part_id: 2 })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Go to part 2' })).toBeNull())
})

it('makes no move at the last part, and names the end instead of showing an error', async () => {
  const last = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', status: 'active', current_part_id: 2 } })
  jest.mocked(useReader).mockReturnValue(reader({ session: last }))
  await render(<Control />, { wrapper })
  const next = screen.getByRole('button', { name: 'Next part' })
  expect(next).toBeDisabled()
  expect(next.props.accessibilityHint).toBe('This is the last part.')
  expect(screen.getByTestId('next-up')).toHaveTextContent('This is the last part.')
  await fireEvent.press(next)
  expect(mockAuthorizedFetch).not.toHaveBeenCalled()
  expect(screen.queryByText('Could not update the service. Please try again.')).toBeNull()
  // Back still moves from the last part, and the deck keeps its size.
  expect(screen.getByRole('button', { name: 'Previous part' })).toBeEnabled()
  expect(screen.getByTestId('control-next')).toHaveStyle({ minHeight: 76 })
})

it('makes no move before the first part of the service', async () => {
  await render(<Control />, { wrapper })
  const back = screen.getByRole('button', { name: 'Previous part' })
  expect(back).toBeDisabled()
  expect(back.props.accessibilityHint).toBe('This is the first part.')
  await fireEvent.press(back)
  expect(mockAuthorizedFetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Next part' })).toBeEnabled()
})

it('names the end the server reports when this device\'s part list is behind', async () => {
  mockAuthorizedFetch.mockResolvedValueOnce(respond(422, { status: 'Could not advance session', current_part_id: 1 }))
  await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  expect(await screen.findByText('This is the last part. There is nothing after it.')).toBeOnTheScreen()
  expect(screen.queryByText('Could not update the service. Please try again.')).toBeNull()
})

it('changes what the congregation sees from one sheet, closing it once the status is picked', async () => {
  await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  expect(screen.getByText('WHAT THE CONGREGATION SEES')).toBeOnTheScreen()
  for (const label of ['Active', 'Gospel Reading', 'Epistle Reading', 'Welcome Message']) expect(screen.getByRole('button', { name: label })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Active' }).props.accessibilityState).toMatchObject({ selected: true })
  await fireEvent.press(screen.getByRole('button', { name: 'Paused' }))
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[0][1]?.body))).toEqual({ status: 'paused' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Paused' })).toBeNull())

  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  expect(screen.getByRole('button', { name: 'Show this' })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText('Message'), '  Coffee hour follows  ')
  await fireEvent.press(screen.getByRole('button', { name: 'Show this' }))
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[1][1]?.body))).toEqual({ status: 'showing_custom', status_message: 'Coffee hour follows' })
  await waitFor(() => expect(screen.queryByLabelText('Message')).toBeNull())
})

it('keeps the sheet open and shows a refused status under the control that failed', async () => {
  mockAuthorizedFetch.mockResolvedValueOnce(respond(422, { error: 'Status cannot change now' }))
  await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Gospel Reading' }))
  expect(await screen.findByText('Status cannot change now')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Gospel Reading' })).toBeOnTheScreen()
  expect(screen.getAllByText('Status cannot change now')).toHaveLength(1)
})

it('holds every other control while a command is running, without disabled styling on the deck', async () => {
  const slow = deferred<Response>()
  mockAuthorizedFetch.mockReturnValueOnce(slow.promise)
  await render(<Control />, { wrapper })
  void fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  await waitFor(() => expect(mockAuthorizedFetch).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previous part' })).toBeDisabled())
  expect(screen.getByTestId('control-previous')).toHaveStyle({ opacity: 0.56 })
  expect(screen.getByTestId('control-next').props.accessibilityState).toMatchObject({ busy: true })
  expect(screen.getByTestId('control-next')).toHaveStyle({ minHeight: 76, opacity: 1 })
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  expect(screen.getByRole('button', { name: 'Paused' })).toBeDisabled()
  slow.resolve(respond(200, {}))
  await waitFor(() => expect(retry).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Paused' })).not.toBeDisabled())
})

it('removes the controls when permission is refused, and leaves the text readable', async () => {
  mockAuthorizedFetch.mockResolvedValueOnce(respond(403, {}))
  await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  expect(await screen.findByText('You do not have permission to control this service.')).toBeOnTheScreen()
  expect(retry).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Next part' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Service' })).toBeNull()
  expect(screen.getByText('Lord, have mercy.')).toBeOnTheScreen()
})

it('says where the service actually is after a refused stale move', async () => {
  mockAuthorizedFetch.mockResolvedValueOnce(respond(409, {}))
  const view = await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  expect(await screen.findByText('The service already moved on, so nothing was changed.')).toBeOnTheScreen()
  expect(retry).toHaveBeenCalled()
  const moved = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', status: 'active', current_part_id: 2 } })
  jest.mocked(useReader).mockReturnValue(reader({ session: moved, updatedAt: 2 }))
  await view.rerender(<Control />)
  expect(await screen.findByText('The service already moved on, so nothing was changed. It is now at 2 · Deacon.')).toBeOnTheScreen()
})

it('queues nothing while offline', async () => {
  ;(globalThis as { __online?: boolean }).__online = false
  await render(<Control />, { wrapper })
  expect(await screen.findByText('You are offline. Reconnect before changing the service.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Next part' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Next part' }))
  expect(mockAuthorizedFetch).not.toHaveBeenCalled()
})

it('states a showing announcement in the header and above the deck, with Stop', async () => {
  jest.mocked(useReader).mockReturnValue(reader({ session: { ...session, status: 'showing_custom', message: 'Coffee hour follows' } }))
  await render(<Control />, { wrapper })
  expect(screen.getByLabelText('Announcement showing')).toBeOnTheScreen()
  expect(screen.getByTestId('announcement-band')).toHaveTextContent(/ON THE SCREEN INSTEAD/)
  expect(screen.getByTestId('announcement-band')).toHaveTextContent(/Coffee hour follows/)
  // The band takes its height from the text region: it is never inside the deck, so Next and Back do not move.
  expect(within(screen.getByTestId('control-deck')).queryByTestId('announcement-band')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Stop showing the announcement' }))
  expect(JSON.parse(String(mockAuthorizedFetch.mock.calls[0][1]?.body))).toEqual({ status: 'active' })
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  expect(screen.getByRole('button', { name: 'Stop showing' })).toBeOnTheScreen()
  expect(screen.queryByLabelText('Message')).toBeNull()
})

it('fills a tablet with the reading beside Grabar and a rail with what is coming up', async () => {
  mockWindow = { width: 1024, height: 768, scale: 2, fontScale: 1 }
  await render(<Control />, { wrapper })
  expect(screen.getByTestId('control-rail')).toBeOnTheScreen()
  expect(screen.getAllByTestId(/^control-text-/).map(node => node.props.testID)).toEqual(['control-text-en', 'control-text-grabar'])
  // Columns are unlabelled, as drawn.
  expect(screen.queryByText(/· comparison/)).toBeNull()
  expect(screen.getByTestId('control-header')).toHaveTextContent(/Divine Liturgy/)
  expect(screen.getByText('COMING UP')).toBeOnTheScreen()
  expect(screen.getByText('Տէր, ողորմեա։')).toBeOnTheScreen()
  expect(screen.getByText('Lord, have mercy.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Next part' })).toHaveTextContent('Next')
  expect(screen.queryByText('Next up · Deacon')).toBeNull()
})

it('lists six parts coming up on a tablet, each with its posture where set', async () => {
  mockWindow = { width: 1024, height: 768, scale: 2, fontScale: 1 }
  const many = normalizeParts({ parts: Array.from({ length: 9 }, (_, offset) => ({ part: { id: offset + 1, position: offset + 1,
    role: offset % 2 ? 'Deacon' : 'Choir', posture: offset === 1 ? 'sit' : null, en: `Part ${offset + 1}` } })) })
  jest.mocked(useReader).mockReturnValue(reader({ parts: many }))
  await render(<Control />, { wrapper })
  expect(screen.getAllByTestId(/^coming-up-/)).toHaveLength(6)
  expect(screen.getByTestId(`coming-up-${many[1].key}`)).toHaveTextContent(/2\s*Deacon\s*sit/)
  expect(screen.getByTestId(`coming-up-${many[1].key}`)).toHaveTextContent(/Part 2/)
})

it('does not pop the control screen when a command returns after the sheet was swiped away', async () => {
  const slow = deferred<Response>()
  mockAuthorizedFetch.mockReturnValueOnce(slow.promise)
  await render(<Control />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  void fireEvent.press(screen.getByRole('button', { name: 'Paused' }))
  await waitFor(() => expect(mockAuthorizedFetch).toHaveBeenCalledTimes(1))
  await fireEvent.press(screen.getByRole('button', { name: 'Close Service' }))
  expect(mockBack).toHaveBeenCalledTimes(1)
  slow.resolve(respond(200, {}))
  await waitFor(() => expect(retry).toHaveBeenCalled())
  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Next part' })).toBeOnTheScreen()
})

it('shows how the next part begins, not only its role', async () => {
  const withMarkup = normalizeParts({ parts: [
    { part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } },
    { part: { id: 2, position: 2, role: 'Deacon', en: '**Let us beseech**\nthe Lord.', grabar: 'Խնդրեսցուք ի Տեառնէ։' } },
  ] })
  jest.mocked(useReader).mockReturnValue(reader({ parts: withMarkup }))
  await render(<Control />, { wrapper })
  expect(screen.getByTestId('next-up')).toHaveTextContent('Next up · DeaconLet us beseech the Lord.')
  await fireEvent.press(screen.getByRole('button', { name: 'Service' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Go to another part' }))
  expect(screen.getAllByText('Let us beseech the Lord.').length).toBeGreaterThan(0)
})

it('keeps Back whole beside a flexing Next', async () => {
  await render(<Control />, { wrapper })
  expect(screen.getByTestId('control-previous')).toHaveStyle({ minWidth: 96 })
  expect(screen.getByTestId('control-previous')).not.toHaveStyle({ width: 96 })
})

it('shows the operator\'s languages in their order: columns in iPad mini landscape, stacked where they would be too narrow', async () => {
  mockStored = JSON.stringify({ language: 'en', selectedLanguages: ['en', 'grabar'], appearance: 'system', readingSize: 'standard', controlLanguages: ['grabar', 'translit', 'en'] })
  mockWindow = { width: 1133, height: 744, scale: 2, fontScale: 1 }
  const view = await render(<Control />, { wrapper })
  await waitFor(() => expect(screen.getAllByTestId(/^control-text-/).map(node => node.props.testID)).toEqual(['control-text-grabar', 'control-text-translit', 'control-text-en']))
  expect(screen.getByTestId('control-text')).toHaveStyle({ flexDirection: 'row' })
  expect(screen.getByRole('button', { name: 'Languages' }).props.accessibilityHint).toBe('Which languages service control shows, and in what order.')
  mockWindow = { width: 744, height: 1133, scale: 2, fontScale: 1 }
  await view.rerender(<Control />)
  expect(screen.getByTestId('control-text')).toHaveStyle({ flexDirection: 'column' })
})

it('arranges control languages from their sheet and remembers them', async () => {
  const { rerender } = await render(<ControlLanguagesSheet />, { wrapper })
  expect(screen.getAllByTestId(/^control-language-/).map(node => node.props.testID)).toEqual(['control-language-en', 'control-language-grabar'])
  await fireEvent.press(screen.getByRole('button', { name: 'Move Classical Armenian up' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add Transliteration' }))
  expect(screen.getAllByTestId(/^control-language-/).map(node => node.props.testID)).toEqual(['control-language-grabar', 'control-language-en', 'control-language-translit'])
  expect(screen.getByRole('button', { name: 'Add Russian' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Classical Armenian up' })).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: 'Remove English' }))
  await waitFor(() => expect(JSON.parse(String(mockStored))).toMatchObject({ controlLanguages: ['grabar', 'translit'] }))
  // Arranging control never changes the reading screen's own languages.
  expect(JSON.parse(String(mockStored))).toMatchObject({ selectedLanguages: ['en', 'grabar', 'translit'] })
  await rerender(<ControlLanguagesSheet />)
  expect(screen.getByRole('button', { name: 'Add Russian' })).not.toBeDisabled()
})
