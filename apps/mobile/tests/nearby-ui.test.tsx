import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { Discovery } from '../features/live/Discovery'
import { normalizeServices } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { useReader } from '../features/live/useReader'

const mockRequestPermission = jest.fn<() => Promise<{ granted: boolean; canAskAgain: boolean }>>()
const mockGetPosition = jest.fn<() => Promise<{ coords: { latitude: number; longitude: number } }>>()

jest.mock('../features/live/useReader')
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestPermission(),
  getCurrentPositionAsync: () => mockGetPosition(),
  Accuracy: { Balanced: 3 },
}))

const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}>{children}</PreferencesProvider></ThemeProvider>
const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const services = normalizeServices({ sessions: [
  { session: { id: 9, church_name: 'St. John Armenian Church', liturgy: 'Divine Liturgy', church_latitude: 37.7509, church_longitude: -122.4477 } },
] })

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, services }, retry: jest.fn(), dispatch: jest.fn() })
  mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true })
  mockGetPosition.mockResolvedValue({ coords: { latitude: 37.7509, longitude: -122.4477 } })
})

it('offers the church you are standing in, without opening it for you', async () => {
  const open = jest.fn()
  await render(<Discovery endpoints={endpoints} open={open} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  expect(await screen.findByText('You appear to be at St. John Armenian Church')).toBeOnTheScreen()
  expect(open).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Open this service at St. John Armenian Church' }))
  expect(open).toHaveBeenCalledWith(9)
})

it('takes one tap to dismiss a wrong guess', async () => {
  await render(<Discovery endpoints={endpoints} open={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  await screen.findByText('You appear to be at St. John Armenian Church')
  await fireEvent.press(screen.getByRole('button', { name: 'Not where I am' }))
  expect(screen.queryByText('You appear to be at St. John Armenian Church')).toBeNull()
  expect(screen.getByRole('button', { name: 'Find my church' })).toBeOnTheScreen()
})

it('never sends the position anywhere', async () => {
  await render(<Discovery endpoints={endpoints} open={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  await screen.findByText('You appear to be at St. John Armenian Church')
  expect(mockGetPosition).toHaveBeenCalledTimes(1)
  // useReader is the only thing that talks to the API here, and it was given no coordinates.
  expect(jest.mocked(useReader).mock.calls.every(call => JSON.stringify(call).includes('37.75') === false)).toBe(true)
})

it('says so when no church is nearby, leaving the list alone', async () => {
  mockGetPosition.mockResolvedValue({ coords: { latitude: 40.7128, longitude: -74.006 } })
  await render(<Discovery endpoints={endpoints} open={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  expect(await screen.findByText('No church with a live service is nearby.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Open Divine Liturgy at St. John Armenian Church' })).toBeOnTheScreen()
})

it('carries on when location is refused or unavailable', async () => {
  mockRequestPermission.mockResolvedValue({ granted: false, canAskAgain: true })
  await render(<Discovery endpoints={endpoints} open={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  expect(await screen.findByText(/list above is unchanged/)).toBeOnTheScreen()

  mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true })
  mockGetPosition.mockRejectedValue(new Error('location services are off'))
  await fireEvent.press(screen.getByRole('button', { name: 'Find my church' }))
  expect(await screen.findByText('Your location is not available right now.')).toBeOnTheScreen()
})

it('does not offer to look when no church has published coordinates', async () => {
  const without = normalizeServices({ sessions: [{ session: { id: 9, church_name: 'St. John', liturgy: 'Divine Liturgy' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, services: without }, retry: jest.fn(), dispatch: jest.fn() })
  await render(<Discovery endpoints={endpoints} open={jest.fn()} />, { wrapper })
  expect(screen.queryByRole('button', { name: 'Find my church' })).toBeNull()
  await waitFor(() => expect(mockRequestPermission).not.toHaveBeenCalled())
})
