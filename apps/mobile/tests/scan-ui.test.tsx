import { beforeEach, expect, it, jest } from '@jest/globals'
import { AccessibilityInfo, Linking } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import ScanScreen, { NOT_A_CODE_MS } from '../app/scan'

const mockPush = jest.fn(), mockReplace = jest.fn(), mockBack = jest.fn()
const mockPermission = { current: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null }
const mockRequestPermission = jest.fn(async () => ({ granted: true }))
const mockScanHandler: { current?: (event: { data: string }) => void } = {}
const mockSession = jest.fn<(id: number) => Promise<unknown>>()

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path), replace: (path: string) => mockReplace(path), back: () => mockBack(), canGoBack: () => true },
}))
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission.current, mockRequestPermission],
  CameraView: (props: { onBarcodeScanned?: (event: { data: string }) => void }) => {
    mockScanHandler.current = props.onBarcodeScanned
    return null
  },
}))
jest.mock('../features/live/config', () => ({ readerConfig: () => ({ endpoints: { api: 'https://example.test', cable: 'wss://example.test/cable' } }) }))
jest.mock('../features/live/api', () => ({ createApi: () => ({ session: (id: number) => mockSession(id) }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const scan = (data: string) => act(() => { mockScanHandler.current?.({ data }) })
const stJohn = { id: 4006, title: 'Divine Liturgy', church: 'St. John Armenian Church', status: 'active' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  mockPermission.current = { granted: true, canAskAgain: true }
  mockSession.mockResolvedValue(stJohn)
})

it('names the target and puts close first and session ID entry right after the instruction', async () => {
  await render(<ScanScreen />, { wrapper })
  expect(screen.getByText('Point your camera at the code on your church’s screen.')).toBeOnTheScreen()
  const buttons = screen.getAllByRole('button')
  expect(buttons[0]).toHaveProp('accessibilityLabel', 'Close')
  expect(buttons[1]).toHaveTextContent('Enter a session ID instead')
  await fireEvent.press(buttons[0])
  expect(mockBack).toHaveBeenCalledTimes(1)
})

it('confirms the service a scanned code points at before entering it', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  await scan('https://web.tarkman.app/sessions/4006/explanations')
  await scan('https://web.tarkman.app/sessions/4006/explanations')
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
  expect(screen.getByText('St. John Armenian Church')).toBeOnTheScreen()
  expect(mockSession).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  expect(announce).toHaveBeenCalledWith('Found Divine Liturgy at St. John Armenian Church, live')
  await fireEvent.press(screen.getByRole('button', { name: 'Pray along' }))
  expect(mockReplace).toHaveBeenCalledWith('/sessions/4006/parts')
})

it('lets the reader reject a found service and scan again', async () => {
  await render(<ScanScreen />, { wrapper })
  await scan('https://www.tarkman.app/s/4006/explain')
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan a different code' }))
  expect(screen.queryByText('Divine Liturgy')).toBeNull()
  await scan('https://www.tarkman.app/s/7/explain')
  expect(mockSession).toHaveBeenLastCalledWith(7)
})

it('refuses a code for anywhere else, never opens it, and alerts once per burst of bad reads', async () => {
  jest.useFakeTimers()
  await render(<ScanScreen />, { wrapper })
  await scan('https://tarkman.app.evil.example/s/4006/explain')
  await scan('https://evil.example/again')
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent('That code isn’t a Tarkman service. Try the code on your church’s screen.')
  expect(mockSession).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  await act(() => { jest.advanceTimersByTime(NOT_A_CODE_MS + 600) })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('says so when a Tarkman code points at a service that is gone', async () => {
  mockSession.mockRejectedValue(new Error('This service is no longer available.'))
  await render(<ScanScreen />, { wrapper })
  await scan('https://www.tarkman.app/s/4006/explain')
  expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t available/)
  await fireEvent.press(screen.getByRole('button', { name: 'Scan again' }))
  expect(screen.queryByRole('alert')).toBeNull()
})

it('asks for the camera when the scanner opens', async () => {
  mockPermission.current = { granted: false, canAskAgain: true }
  await render(<ScanScreen />, { wrapper })
  expect(mockRequestPermission).toHaveBeenCalledTimes(1)
})

it('names the routes that still work when the camera is refused', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
  mockPermission.current = { granted: false, canAskAgain: false }
  await render(<ScanScreen />, { wrapper })
  expect(screen.getByText(/You can still open a service from the list or by session ID/)).toBeOnTheScreen()
  expect(mockRequestPermission).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }))
  expect(openSettings).toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }))
  expect(mockReplace).toHaveBeenCalledWith('/')
})

it('opens a validated session ID as the scanner fallback', async () => {
  await render(<ScanScreen />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Enter a session ID instead' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Open session' }))
  expect(screen.getByText('Enter a valid numeric session ID.')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Session ID'), '7')
  await fireEvent(screen.getByLabelText('Session ID'), 'submitEditing')
  expect(mockReplace).toHaveBeenCalledWith('/sessions/7/parts')
})
