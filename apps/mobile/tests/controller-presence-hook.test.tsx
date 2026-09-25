import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, render, renderHook, screen } from '@testing-library/react-native'
import { AppState, Platform, Text } from 'react-native'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import { ServiceControlProvider, useServiceControl } from '../features/services/ServiceControlProvider'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import { useControllerPresence } from '../features/services/presence/useControllerPresence'
import type { AuthContextValue } from '../features/auth/AuthProvider'

jest.mock('expo-router', () => ({ usePathname: () => mockPath }))
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }))
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }))
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => mockAuthContext }))
jest.mock('../features/live/useReader')
jest.mock('../features/services/useControls', () => ({ useControls: () => ({ online: true, running: null, failure: null, error: null, failed: null, forbidden: false, run: async () => false }) }))
let mockPath = '/services/9'
let signIn: AuthContextValue['state'] = { status: 'signedIn', token: 'token', user: { id: 1 } as never }
let listeners = new Set<() => void>()
let mockAuthContext: AuthContextValue
let network!: (state: NetworkState) => void
let app!: (state: 'active' | 'background' | 'inactive') => void
let resolveNetwork!: (state: NetworkState) => void
const removeNetwork = jest.fn()
const removeApp = jest.fn()
const online = { isConnected: true, isInternetReachable: true } as NetworkState
const unknown = { isConnected: true, isInternetReachable: undefined } as NetworkState
const calls: { path: string; sequence: number; active: boolean; signal?: AbortSignal; resolve?: (value: Response) => void }[] = []
let deferred = false
const fetcher: AuthContextValue['authorizedFetch'] = async (url, init) => {
  const body = JSON.parse(init!.body as string) as { sequence: number; active: boolean }
  const call = { path: url, ...body, signal: init?.signal as AbortSignal | undefined, resolve: undefined as ((value: Response) => void) | undefined }
  calls.push(call)
  if (deferred && body.active) return new Promise<Response>(resolve => { call.resolve = resolve })
  return reply(body.sequence, body.active)
}
function reply(sequence: number, active: boolean): Response {
  return { ok: true, status: 200, json: async () => ({ session_id: Number(calls.at(-1)!.path.split('/')[2]),
    reporting_scope: 'participating_clients', controller_count: active ? 1 : 0, other_controller_count: 0,
    self_present: active, accepted_sequence: sequence, server_time: '2026-09-25T12:00:00Z',
    self_expires_at: active ? '2026-09-25T12:00:45Z' : null, heartbeat_interval_seconds: 10, lease_ttl_seconds: 45 }) } as Response
}
async function flush() { await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }) }
async function changeNetwork(state: NetworkState) { await act(async () => network(state)) }
function context() {
  mockAuthContext = { state: signIn, authorizedFetch: fetcher, beforeSignOut: callback => {
    listeners.add(callback); return () => { listeners.delete(callback) }
  }, signIn: async () => {}, signOut: () => { listeners.forEach(callback => callback()); signIn = { status: 'signedOut' }; mockAuthContext = { ...mockAuthContext, state: signIn } } }
}
beforeEach(() => {
  jest.useFakeTimers(); calls.length = 0; listeners = new Set(); mockPath = '/services/9'; deferred = false
  signIn = { status: 'signedIn', token: 'token', user: { id: 1 } as never }; context()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { app = callback as typeof app; return { remove: removeApp } })
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' })
  jest.mocked(addNetworkStateListener).mockImplementation(callback => { network = callback; return { remove: removeNetwork } })
  jest.mocked(getNetworkStateAsync).mockImplementation(() => new Promise(resolve => { resolveNetwork = resolve }))
  process.env.EXPO_PUBLIC_API_URL = 'https://one.test'
  process.env.EXPO_PUBLIC_ACTIONCABLE_URL = 'wss://one.test/cable'
  jest.mocked(useReader).mockReturnValue({ state: initialState, retry: jest.fn(), refreshAfterCommand: jest.fn() } as never)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); removeApp.mockClear(); removeNetwork.mockClear() })

it('shares one lifecycle through child sheets and fences route, session, account and API changes on render', async () => {
  const hook = await renderHook(({ id, api }: { id: number; api: string }) => useControllerPresence(id, api), { initialProps: { id: 9, api: 'https://one.test' } })
  expect(Platform.OS).toBe('ios')
  expect(AppState.currentState).toBe('active')
  expect(hook.result.current.kind).toBe('unavailable') // unknown network is conservative
  await changeNetwork(unknown); expect(calls).toHaveLength(0)
  await changeNetwork(online); await flush()
  expect(calls.length).toBe(1)
  await hook.rerender({ id: 9, api: 'https://one.test' })
  expect(hook.result.current.kind).toBe('fresh')
  for (const child of ['/services/9/service', '/services/9/languages', '/services/9']) {
    mockPath = child; await hook.rerender({ id: 9, api: 'https://one.test' })
    expect(hook.result.current.kind).toBe('fresh')
    expect(calls).toHaveLength(1)
  }
  await hook.rerender({ id: 9, api: 'https://two.test' })
  expect(hook.result.current.kind).not.toBe('fresh')
  await changeNetwork(online); await flush()
  expect(hook.result.current.kind).toBe('fresh')
  await hook.rerender({ id: 10, api: 'https://two.test' })
  expect(hook.result.current.kind).not.toBe('fresh')
  mockPath = '/services/10'; await hook.rerender({ id: 10, api: 'https://two.test' })
  await changeNetwork(online); await flush()
  expect(hook.result.current.kind).toBe('fresh')
  signIn = { status: 'signedIn', token: 'token', user: { id: 2 } as never }; context()
  await hook.rerender({ id: 10, api: 'https://two.test' })
  expect(hook.result.current.kind).not.toBe('fresh')
  await changeNetwork(online); await flush()
  expect(hook.result.current.kind).toBe('fresh')
  mockPath = '/services'; await hook.rerender({ id: 10, api: 'https://two.test' })
  expect(hook.result.current.kind).toBe('unavailable')
  mockPath = '/services/10'; await hook.rerender({ id: 10, api: 'https://two.test' })
  expect(hook.result.current.kind).not.toBe('fresh')
  await changeNetwork(online); await flush()
  expect(hook.result.current.kind).toBe('fresh')
  expect(calls.filter(call => call.active).length).toBe(5)
  await hook.unmount()
  expect(listeners.size).toBe(0)
  expect(removeNetwork).toHaveBeenCalled()
  expect(removeApp).toHaveBeenCalled()
  resolveNetwork(online); await flush()
})

it('leaves before sign-out and background, resumes with a higher sequence and ignores delayed heartbeats', async () => {
  deferred = true
  const hook = await renderHook(() => useControllerPresence(9, 'https://one.test'))
  await changeNetwork(online)
  expect(calls[0].sequence).toBe(1)
  await act(async () => app('background'))
  expect(calls[1]).toMatchObject({ sequence: 2, active: false })
  await act(async () => app('active'))
  expect(calls[2]).toMatchObject({ sequence: 3, active: true })
  await act(async () => { calls[0].resolve!(reply(1, true)); await Promise.resolve() })
  expect(hook.result.current.kind).toBe('checking')
  await act(async () => { calls[2].resolve!(reply(3, true)); await Promise.resolve() })
  expect(hook.result.current.kind).toBe('fresh')
  await act(async () => mockAuthContext.signOut())
  expect(calls[3]).toMatchObject({ sequence: 4, active: false })
  await hook.rerender(undefined)
  expect(hook.result.current.kind).toBe('unavailable')
  await hook.unmount()
  expect(listeners.size).toBe(0)
})

it('keeps sequence across provider remount and treats offline/unknown as ineligible', async () => {
  const first = await renderHook(() => useControllerPresence(9, 'https://one.test'))
  await changeNetwork(online); await flush()
  await first.unmount()
  expect(calls.map(call => call.sequence)).toEqual([1, 2])
  const second = await renderHook(() => useControllerPresence(9, 'https://one.test'))
  await changeNetwork(unknown); expect(calls).toHaveLength(2)
  await changeNetwork(online); await flush()
  expect(calls[2].sequence).toBe(3)
  await changeNetwork({ isConnected: false, isInternetReachable: false } as NetworkState)
  expect(calls[3]).toMatchObject({ sequence: 4, active: false })
  await second.unmount()
  expect(calls).toHaveLength(4)
})

it('uses web document visibility rather than native AppState', async () => {
  const originalPlatform = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    visibilityState: 'hidden', addEventListener: jest.fn(), removeEventListener: jest.fn(),
  } })
  const document = globalThis.document
  const hook = await renderHook(() => useControllerPresence(9, 'https://one.test'))
  await changeNetwork(online); expect(calls).toHaveLength(0)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  const visibility = jest.mocked(document.addEventListener).mock.calls[0][1] as EventListener
  await act(async () => visibility(new Event('visibilitychange')))
  await flush(); expect(calls).toHaveLength(1)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  await act(async () => visibility(new Event('visibilitychange')))
  expect(calls[1].active).toBe(false)
  await hook.unmount()
  expect(document.removeEventListener).toHaveBeenCalled()
  expect(removeApp).not.toHaveBeenCalled()
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  Reflect.deleteProperty(globalThis, 'document')
})

function Status() {
  const { presence } = useServiceControl()
  return <Text testID="shared-presence">{presence.kind}</Text>
}
it('mounts one provider across the control screen and both child sheets without another registration or command', async () => {
  const view = await render(<ServiceControlProvider sessionId={9}><Status /></ServiceControlProvider>)
  await changeNetwork(online); await flush()
  expect(screen.getByTestId('shared-presence')).toHaveTextContent('fresh')
  for (const child of ['/services/9/service', '/services/9/languages', '/services/9']) {
    mockPath = child
    await view.rerender(<ServiceControlProvider sessionId={9}><Status /></ServiceControlProvider>)
    expect(screen.getByTestId('shared-presence')).toHaveTextContent('fresh')
  }
  expect(calls.filter(call => call.active)).toHaveLength(1)
  expect(useReader).toHaveBeenCalled()
  expect(calls.every(call => call.path.includes('controller_presence'))).toBe(true)
  await view.unmount()
  expect(calls.filter(call => !call.active)).toHaveLength(1)
})
