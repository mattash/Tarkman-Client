import { expect, it, jest, beforeEach } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { OpeningIntentHandler } from '../features/siri/OpeningIntentHandler.ios'

const mockUseAppIntents = jest.fn<(handler: unknown) => void>()
let mockNavigation: { key: string } | undefined
let mockReady = false
jest.mock('expo-app-intents', () => ({ useAppIntents: (handler: unknown) => mockUseAppIntents(handler), removePendingInvocationAsync: async () => {} }))
jest.mock('expo-router', () => ({ useRootNavigationState: () => mockNavigation, router: { replace: jest.fn() } }))
jest.mock('../features/library/LibraryProvider', () => ({ useLibrary: () => ({ state: { ready: mockReady } }) }))

beforeEach(() => { mockNavigation = undefined; mockReady = false; mockUseAppIntents.mockClear() })
it('does not drain pending cold invocations before navigation and library hydration are ready', async () => {
  const view = await render(<OpeningIntentHandler />)
  expect(mockUseAppIntents).not.toHaveBeenCalled()
  mockNavigation = { key: 'root' }
  await view.rerender(<OpeningIntentHandler />)
  expect(mockUseAppIntents).not.toHaveBeenCalled()
  mockReady = true
  await view.rerender(<OpeningIntentHandler />)
  expect(mockUseAppIntents).toHaveBeenCalledTimes(1)
})
