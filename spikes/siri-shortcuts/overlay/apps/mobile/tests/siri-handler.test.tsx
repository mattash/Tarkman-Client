import { expect, it, jest, beforeEach } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { OpeningIntentHandler } from '../features/siri/OpeningIntentHandler.ios'

const mockUseAppIntents = jest.fn<(handler: unknown) => void>()
const mockDiagnostic = jest.fn<(stage: string) => void>()
let mockAvailable = true
let mockNavigation: { key: string } | undefined
let mockReady = false
jest.mock('expo-app-intents', () => ({ isAvailable: () => mockAvailable, useAppIntents: (handler: unknown) => mockUseAppIntents(handler), removePendingInvocationAsync: async () => {} }))
jest.mock('../features/siri/spikeDiagnostics', () => ({ recordSpikeDiagnostic: (stage: string) => mockDiagnostic(stage) }))
jest.mock('expo-router', () => ({ useRootNavigationState: () => mockNavigation, router: { replace: jest.fn() } }))
jest.mock('../features/library/LibraryProvider', () => ({ useLibrary: () => ({ state: { ready: mockReady } }) }))

beforeEach(() => { mockNavigation = undefined; mockReady = false; mockAvailable = true; mockUseAppIntents.mockClear(); mockDiagnostic.mockClear() })
it('does not drain pending cold invocations before navigation and library hydration are ready', async () => {
  const view = await render(<OpeningIntentHandler />)
  expect(mockUseAppIntents).not.toHaveBeenCalled()
  expect(mockDiagnostic).toHaveBeenCalledWith('module:available')
  expect(mockDiagnostic).toHaveBeenCalledWith('root:waiting')
  mockNavigation = { key: 'root' }
  await view.rerender(<OpeningIntentHandler />)
  expect(mockUseAppIntents).not.toHaveBeenCalled()
  mockReady = true
  await view.rerender(<OpeningIntentHandler />)
  expect(mockUseAppIntents).toHaveBeenCalledTimes(1)
  expect(mockDiagnostic).toHaveBeenCalledWith('root:ready')
})
it('records native-module absence rather than claiming a dispatched invocation', async () => {
  mockAvailable = false
  await render(<OpeningIntentHandler />)
  expect(mockDiagnostic).toHaveBeenCalledWith('module:unavailable')
  expect(mockUseAppIntents).not.toHaveBeenCalled()
})
