import { jest } from '@jest/globals'

jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(() => Promise.resolve()), deactivateKeepAwake: jest.fn(() => Promise.resolve()) }))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}))
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }))

// The Siri Remote in tests: screens subscribe through useTVEventHandler; tests call remote('select').
const mockTvHandlers = new Set<(event: { eventType: string }) => void>()
jest.mock('react-native/Libraries/Components/TV/useTVEventHandler', () => {
  const { useEffect, useRef } = jest.requireActual<typeof import('react')>('react')
  function useTVEventHandler(handler: (event: { eventType: string }) => void) {
    const latest = useRef(handler)
    useEffect(() => { latest.current = handler })
    useEffect(() => { const listener = (event: { eventType: string }) => latest.current(event); mockTvHandlers.add(listener); return () => { mockTvHandlers.delete(listener) } }, [])
  }
  return { __esModule: true, default: useTVEventHandler }
})
;(globalThis as { remote?: (eventType: string) => void }).remote = eventType => { [...mockTvHandlers].forEach(handler => handler({ eventType })) }
