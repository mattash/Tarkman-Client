import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { AccessibilityInfo, AppState, Linking, Platform, type AppStateStatus } from 'react-native'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import ScanScreen, { NOT_A_CODE_MS } from '../app/scan'

const mockPush = jest.fn(), mockReplace = jest.fn(), mockBack = jest.fn()
const mockPermission = { current: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null }
const mockRequestPermission = jest.fn(async () => ({ granted: true }))
const mockScanHandler: { current?: (event: { data: string }) => void } = {}
const mockSession = jest.fn<(id: number, signal: AbortSignal) => Promise<unknown>>()
const mockFocus: { effect?: () => void | (() => void); cleanup?: () => void } = {}
const mockCamera = { active: undefined as boolean | undefined, mounts: 0, unmounts: 0 }
const mockAppStateListeners = new Set<(state: AppStateStatus) => void>()
const originalAppStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState')!

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path), replace: (path: string) => mockReplace(path), back: () => mockBack(), canGoBack: () => true },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => {
      mockFocus.effect = effect
      mockFocus.cleanup = effect() || undefined
      return () => {
        mockFocus.cleanup?.()
        mockFocus.cleanup = undefined
        mockFocus.effect = undefined
      }
    }, [effect])
  },
}))
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission.current, mockRequestPermission],
  CameraView: (props: { active?: boolean; onBarcodeScanned?: (event: { data: string }) => void }) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => {
      mockCamera.mounts += 1
      return () => {
        mockCamera.unmounts += 1
        mockCamera.active = undefined
        mockScanHandler.current = undefined
      }
    }, [])
    mockCamera.active = props.active
    mockScanHandler.current = props.onBarcodeScanned
    return null
  },
}))
jest.mock('../features/live/config', () => ({ readerConfig: () => ({ endpoints: { api: 'https://example.test', cable: 'wss://example.test/cable' } }) }))
jest.mock('../features/live/api', () => ({ createApi: () => ({ session: (id: number, signal: AbortSignal) => mockSession(id, signal) }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const scan = (data: string) => act(() => { mockScanHandler.current?.({ data }) })
const stJohn = { id: 4006, title: 'Divine Liturgy', church: 'St. John Armenian Church', status: 'active' }
const code = 'https://web.tarkman.app/sessions/4006/explanations'

function deferred<Value>() {
  let resolve!: (value: Value) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// Deliberately ignore AbortSignal: even a transport that settles after abort must be harmless.
function delayedSession() {
  const pending = deferred<typeof stJohn>()
  mockSession.mockImplementationOnce(() => pending.promise)
  return pending
}

async function settle(pending: ReturnType<typeof delayedSession>, outcome: 'success' | 'failure', session = stJohn) {
  await act(async () => {
    if (outcome === 'success') pending.resolve(session)
    else pending.reject(new Error('Late lookup failure'))
    await pending.promise.catch(() => {})
  })
}

async function blur() {
  await act(() => {
    mockFocus.cleanup?.()
    mockFocus.cleanup = undefined
  })
}

async function focus() {
  await act(() => { mockFocus.cleanup = mockFocus.effect?.() || undefined })
}

async function appState(state: AppStateStatus) {
  await act(() => { for (const listener of [...mockAppStateListeners]) listener(state) })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  jest.replaceProperty(Platform, 'OS', 'ios')
  // The RN preset uses a jest.fn(); production exposes a nullable state value.
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  })
  mockAppStateListeners.clear()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    mockAppStateListeners.add(listener)
    return { remove: () => { mockAppStateListeners.delete(listener) } }
  })
  mockPermission.current = { granted: true, canAskAgain: true }
  mockSession.mockReset().mockResolvedValue(stJohn)
  mockScanHandler.current = undefined
  mockCamera.active = undefined
  mockCamera.mounts = 0
  mockCamera.unmounts = 0
})

afterEach(async () => {
  // Finish effect cleanup before restoring lifecycle mocks and their subscriptions.
  await cleanup()
  jest.restoreAllMocks()
  Object.defineProperty(AppState, 'currentState', originalAppStateDescriptor)
  jest.useRealTimers()
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
  await scan(code)
  await scan(code)
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
  expect(screen.getByText('St. John Armenian Church')).toBeOnTheScreen()
  expect(mockSession).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  expect(announce).toHaveBeenCalledWith('Found Divine Liturgy at St. John Armenian Church, live')
  await fireEvent.press(await screen.findByRole('button', { name: 'Pray along' }))
  expect(mockReplace).toHaveBeenCalledWith('/sessions/4006/parts')
})

it('lets the reader reject a found service and scan again', async () => {
  await render(<ScanScreen />, { wrapper })
  await scan('https://www.tarkman.app/s/4006/explain')
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan a different code' }))
  expect(screen.queryByText('Divine Liturgy')).toBeNull()
  await scan('https://www.tarkman.app/s/7/explain')
  expect(mockSession).toHaveBeenLastCalledWith(7, expect.objectContaining({ aborted: false }))
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

it('accepts only one barcode callback before React rerenders', async () => {
  await render(<ScanScreen />, { wrapper })
  const handler = mockScanHandler.current!
  await act(() => { handler({ data: code }); handler({ data: code }) })
  expect(mockSession).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
})

it.each(['success', 'failure'] as const)('preserves manual entry after a cancelled lookup returns %s', async outcome => {
  const pending = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  const bufferedHandler = mockScanHandler.current!
  await scan(code)
  const signal = mockSession.mock.calls[0][1]
  expect(signal.aborted).toBe(false)
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter a session ID instead' }))
  expect(signal.aborted).toBe(true)
  await fireEvent.changeText(screen.getByLabelText('Session ID'), '123')
  await act(() => { bufferedHandler({ data: code }) })
  await settle(pending, outcome)
  expect(screen.getByLabelText('Session ID')).toHaveProp('value', '123')
  expect(screen.queryByRole('button', { name: 'Pray along' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mockSession).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  expect(announce).not.toHaveBeenCalled()
  expect(mockCamera.active).toBe(false)
})

it.each(['success', 'failure'] as const)('ignores an older %s while a new scan is checking', async outcome => {
  const old = delayedSession()
  const next = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  await scan(code)
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter a session ID instead' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Back to scanning' }))
  await scan('https://www.tarkman.app/s/7/explain')
  const nextSignal = mockSession.mock.calls[1][1]
  await settle(old, outcome)
  expect(screen.queryByRole('button', { name: 'Pray along' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(nextSignal.aborted).toBe(false)
  expect(announce).not.toHaveBeenCalled()
  await settle(next, 'success', { ...stJohn, id: 7, title: 'Evening Prayer' })
  expect(screen.getByText('Evening Prayer')).toBeOnTheScreen()
  expect(announce).toHaveBeenCalledTimes(1)
  await fireEvent.press(await screen.findByRole('button', { name: 'Pray along' }))
  expect(mockReplace).toHaveBeenCalledWith('/sessions/7/parts')
})

it.each(['success', 'failure'] as const)('cancels immediately on Close and ignores a late %s', async outcome => {
  const pending = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  const bufferedHandler = mockScanHandler.current!
  await scan(code)
  const signal = mockSession.mock.calls[0][1]
  // Router is mocked: this deliberately leaves the React screen mounted after Close.
  await fireEvent.press(screen.getByTestId('scan-close'))
  expect(signal.aborted).toBe(true)
  expect(mockBack).toHaveBeenCalledTimes(1)
  await act(() => { bufferedHandler({ data: code }) })
  await settle(pending, outcome)
  expect(screen.queryByRole('button', { name: 'Pray along' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(announce).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(mockSession).toHaveBeenCalledTimes(1)
  expect(mockCamera.unmounts).toBe(1)
})

it.each(['success', 'failure'] as const)('aborts on unmount without announcing a late %s', async outcome => {
  const pending = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  const view = await render(<ScanScreen />, { wrapper })
  await scan(code)
  const signal = mockSession.mock.calls[0][1]
  await view.unmount()
  expect(signal.aborted).toBe(true)
  expect(mockAppStateListeners.size).toBe(0)
  await settle(pending, outcome)
  expect(announce).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

it.each(['success', 'failure'] as const)('cancels on route blur, ignores late %s, and scans again on focus', async outcome => {
  const pending = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  const bufferedHandler = mockScanHandler.current!
  await scan(code)
  const signal = mockSession.mock.calls[0][1]
  await blur()
  expect(signal.aborted).toBe(true)
  expect(mockCamera.unmounts).toBe(1)
  await act(() => { bufferedHandler({ data: code }) })
  expect(mockSession).toHaveBeenCalledTimes(1)
  await focus()
  expect(mockCamera.active).toBe(true)
  await settle(pending, outcome)
  expect(announce).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).toBeNull()
  await scan(code)
  expect(mockSession).toHaveBeenCalledTimes(2)
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
})

it.each(['inactive', 'background'] as const)('pauses without remounting the iOS camera while %s', async state => {
  const pending = delayedSession()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  await render(<ScanScreen />, { wrapper })
  const bufferedHandler = mockScanHandler.current!
  await scan(code)
  await appState(state)
  expect(mockSession.mock.calls[0][1].aborted).toBe(true)
  expect(mockCamera.active).toBe(false)
  expect(mockCamera.unmounts).toBe(0)
  await act(() => { bufferedHandler({ data: code }) })
  expect(mockSession).toHaveBeenCalledTimes(1)
  await settle(pending, 'success')
  expect(announce).not.toHaveBeenCalled()
  await appState('active')
  expect(mockCamera.active).toBe(true)
  expect(mockCamera.mounts).toBe(1)
  await scan(code)
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
})

it('keeps one iOS camera mount and activates it only when scanning', async () => {
  const pending = delayedSession()
  await render(<ScanScreen />, { wrapper })
  expect(mockCamera.active).toBe(true)
  await scan(code)
  expect(mockCamera.active).toBe(false)
  expect(mockScanHandler.current).toBeUndefined()
  await settle(pending, 'success')
  expect(mockCamera.active).toBe(false)
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan a different code' }))
  expect(mockCamera.active).toBe(true)
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter a session ID instead' }))
  expect(mockCamera.active).toBe(false)
  await fireEvent.press(screen.getByRole('button', { name: 'Back to scanning' }))
  expect(mockCamera.active).toBe(true)
  mockSession.mockRejectedValueOnce(new Error('Gone'))
  await scan(code)
  expect(await screen.findByRole('alert')).toBeOnTheScreen()
  expect(mockCamera.active).toBe(false)
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan again' }))
  expect(mockCamera.active).toBe(true)
  expect(mockCamera.mounts).toBe(1)
  expect(mockCamera.unmounts).toBe(0)
})

it.each(['android', 'web'] as const)('unmounts the idle camera on %s where active is not supported', async platform => {
  jest.replaceProperty(Platform, 'OS', platform)
  await render(<ScanScreen />, { wrapper })
  expect(mockCamera.mounts).toBe(1)
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter a session ID instead' }))
  expect(mockCamera.unmounts).toBe(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Back to scanning' }))
  expect(mockCamera.mounts).toBe(2)
  await appState('background')
  expect(mockCamera.unmounts).toBe(2)
})
