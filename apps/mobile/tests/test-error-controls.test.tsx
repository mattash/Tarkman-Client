import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Sentry from '@sentry/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import type { ObservabilityConfig } from '../features/observability/sentry'
import { showsTestErrorControls, TestErrorControls } from '../features/observability/TestErrorControls'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(() => 'event-1'),
  nativeCrash: jest.fn(),
}))

beforeEach(() => { jest.clearAllMocks() })

const reporting = (environment: string): ObservabilityConfig => ({ enabled: true, dsn: 'https://key@example.ingest.sentry.io/1', environment, tracesSampleRate: 0 })

it('offers deliberate errors in development and preview builds only', () => {
  expect(showsTestErrorControls(reporting('development'), true)).toBe(true)
  expect(showsTestErrorControls(reporting('preview'), false)).toBe(true)
  expect(showsTestErrorControls(reporting('production'), false)).toBe(false)
  expect(showsTestErrorControls(reporting('development'), false)).toBe(false)
})

it('renders nothing in a production build', async () => {
  await render(<ThemeProvider><TestErrorControls config={reporting('production')} isDevelopment={false} /></ThemeProvider>)
  expect(screen.queryByText('Send a test error')).toBeNull()
  expect(screen.queryByText('Crash the app (native)')).toBeNull()
})

it('sends a JavaScript error and triggers a native crash from a preview build', async () => {
  await render(<ThemeProvider><TestErrorControls config={reporting('preview')} isDevelopment={false} /></ThemeProvider>)
  fireEvent.press(screen.getByText('Send a test error'))
  expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tarkman controlled test error' }))
  expect(await screen.findByText('Sent. Event event-1.')).toBeTruthy()
  fireEvent.press(screen.getByText('Crash the app (native)'))
  expect(Sentry.nativeCrash).toHaveBeenCalledTimes(1)
})
