import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { createAppLifecycle, createContracts, createReaderApi, createReaderController, type AppStateSource, type CableClient, type NetworkSource,
  type ReaderApi, type ReaderMessageKey, type ReaderObservability } from '@tarkman/reader'

// The engine as a host without mobile's catalogs or benchmark bridge sees it (apps/tv).
const text = (key: ReaderMessageKey) => `tv:${key}`
const { normalizeSession } = createContracts(text)
const session = normalizeSession({ session: { id: 7, current_part_id: 1 } })
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
let api: jest.Mocked<ReaderApi>, cable: CableClient
beforeEach(() => {
  jest.useFakeTimers()
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue([]), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
  cable = { subscribe: jest.fn<CableClient['subscribe']>().mockReturnValue(() => {}) }
})
afterEach(() => { jest.useRealTimers() })

it('reports failures and fallbacks through the host text adapter', async () => {
  expect(session.title).toBe('tv:fallbacks.service')
  expect(() => createContracts(text).normalizeParts({})).toThrow('tv:errors.unexpectedParts')
  api.session.mockRejectedValue(new Error('offline'))
  const controller = createReaderController({ api, cable, cableUrl: 'wss://example.test/cable', lifecycle: { listen: () => () => {} }, id: 7, text })
  const stop = controller.start(); await flush()
  expect(controller.getSnapshot().error).toBe('tv:errors.refreshService')
  stop(); expect(jest.getTimerCount()).toBe(0)
})

it('runs without observability and forwards traces when a host provides it', async () => {
  const request = jest.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ sessions: [] }), { status: 200 }))
  await createReaderApi({ base: 'https://api.example.test', text, request, timeZone: () => 'Asia/Yerevan' }).services(new AbortController().signal)
  expect(request.mock.calls[0][0]).toBe('https://api.example.test/services.json?tz=Asia%2FYerevan')
  const marks: string[] = []
  const observability: ReaderObservability = { context: () => ({}), mark: name => { marks.push(name) }, beginRecovery: () => ({}), inheritRecovery: () => {},
    recoveryContext: () => ({}), headers: () => ({ 'X-Trace': 'yes' }), cable: () => {} }
  await createReaderApi({ base: 'https://api.example.test', text, request, observability }).services(new AbortController().signal)
  expect(request.mock.calls[1][1]?.headers).toMatchObject({ 'X-Trace': 'yes', 'X-Polling-Client': 'true' })
  expect(marks).toEqual(['fetch.start', 'fetch.headers', 'fetch.parsed'])
})

it('derives foreground and reachability from injected AppState and network sources', async () => {
  let appListener!: (state: string) => void, networkListener!: Parameters<NetworkSource['addNetworkStateListener']>[0]
  const removeApp = jest.fn(), removeNetwork = jest.fn()
  const app: AppStateSource = { currentState: 'active', addEventListener: (_type, listener) => { appListener = listener; return { remove: removeApp } } }
  const network: NetworkSource = { addNetworkStateListener: listener => { networkListener = listener; return { remove: removeNetwork } },
    getNetworkStateAsync: () => Promise.resolve({ isConnected: true, isInternetReachable: true }) }
  const seen: [boolean, boolean][] = []
  const stop = createAppLifecycle(app, network).listen((active, online) => { seen.push([active, online]) })
  networkListener({ isConnected: true, isInternetReachable: false }); await flush()
  appListener('background')
  expect(seen).toEqual([[true, true], [true, false], [false, false]])
  stop(); expect(removeApp).toHaveBeenCalledTimes(1); expect(removeNetwork).toHaveBeenCalledTimes(1)
})

it('keeps the engine free of platform imports so each app bundles it against its own React Native', () => {
  const script = join(__dirname, '../../../packages/tarkman-reader/scripts/check-boundary.mjs')
  expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toContain('Reader boundary OK')
})
