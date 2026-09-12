import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import ScanScreen from '../app/scan'

const mockPush = jest.fn(), mockReplace = jest.fn()
const mockPermission = { current: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null }
const mockRequestPermission = jest.fn(async () => ({ granted: true }))
const mockScanHandler: { current?: (event: { data: string }) => void } = {}

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path), replace: (path: string) => mockReplace(path), back: jest.fn(), canGoBack: () => false },
}))
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission.current, mockRequestPermission],
  CameraView: (props: { onBarcodeScanned?: (event: { data: string }) => void }) => {
    mockScanHandler.current = props.onBarcodeScanned
    return null
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const scan = (data: string) => mockScanHandler.current?.({ data })

beforeEach(() => {
  jest.clearAllMocks()
  mockPermission.current = { granted: true, canAskAgain: true }
})

it('opens the service a scanned code points at, once', async () => {
  await render(<ScanScreen />, { wrapper })
  scan('https://www.tarkman.app/s/4006/explain')
  scan('https://www.tarkman.app/s/4006/explain')
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/sessions/4006/parts')
})

it('opens a part link directly', async () => {
  await render(<ScanScreen />, { wrapper })
  scan('https://web.tarkman.app/sessions/4006/part/2066')
  expect(mockReplace).toHaveBeenCalledWith('/sessions/4006/part/2066')
})

it('refuses a code for anywhere else and never opens it', async () => {
  await render(<ScanScreen />, { wrapper })
  scan('https://tarkman.app.evil.example/s/4006/explain')
  expect(mockReplace).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  expect(await screen.findByText(/does not open a Tarkman service/)).toBeOnTheScreen()
  expect(screen.getByText('https://tarkman.app.evil.example/s/4006/explain')).toBeOnTheScreen()
})

it('scans again after refusing one code', async () => {
  await render(<ScanScreen />, { wrapper })
  scan('https://evil.example/s/1/explain')
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan again' }))
  scan('https://www.tarkman.app/s/7/explain')
  expect(mockReplace).toHaveBeenCalledWith('/sessions/7/parts')
})

it('explains the camera and offers the service-ID entry when permission is missing', async () => {
  mockPermission.current = { granted: false, canAskAgain: true }
  await render(<ScanScreen />, { wrapper })
  expect(screen.getByText(/only to read a service code/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Allow the camera' }))
  expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Enter a service ID' }))
  expect(mockReplace).toHaveBeenCalledWith('/')
})

it('points at Settings when permission can no longer be asked for', async () => {
  mockPermission.current = { granted: false, canAskAgain: false }
  await render(<ScanScreen />, { wrapper })
  expect(screen.getByRole('alert')).toHaveTextContent(/Settings app/)
  expect(screen.queryByRole('button', { name: 'Allow the camera' })).toBeNull()
})
