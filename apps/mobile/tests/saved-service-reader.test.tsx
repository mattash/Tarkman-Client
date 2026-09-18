import * as ReactNative from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react-native'
import type { KeyValueAdapter } from '@tarkman/core'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { SessionReader } from '../features/live/SessionReader'
import { PartList } from '../features/live/PartList'
import { createApi, type ReaderApi } from '../features/live/api'
import { createCable, type CableCallbacks } from '../features/live/cable'
import { lifecycle } from '../features/live/lifecycle'
import { useReader } from '../features/live/useReader'
import * as position from '../features/live/livePosition'
import { normalizeSession, normalizeParts, normalizeExplanations } from '../features/live/contracts'
import { buildSavedService, SAVED_SERVICE_TTL_MS } from '../features/offline/savedService'
import { useSavedService } from '../features/offline/useSavedService'
import { preferencesStore } from '../features/preferences/storage'

jest.mock('../features/live/api')
jest.mock('../features/live/cable')
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: jest.fn() } }))
jest.mock('../features/preferences/storage', () => ({ preferencesStore: { get: jest.fn(), set: jest.fn(), remove: jest.fn() } }))
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
// Observe the actual list's safety props while still rendering its accessible rows.
jest.mock('../features/live/PartList', () => {
  const actual = jest.requireActual<typeof import('../features/live/PartList')>('../features/live/PartList')
  return { PartList: jest.fn(actual.PartList) }
})
const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const session = normalizeSession({ session: { id: 7, current_part_id: 1, liturgy: 'Prayer', status: 'active' } })
const parts = (text: string) => normalizeParts({ parts: [{ part: { id: 1, role: 'Choir', en: text, liturgy_part_id: 11 } }] })
const record = () => buildSavedService({ session: { ...session, title: 'Saved service title', church: 'Saved church', date: '2026-09-13' }, parts: parts('Saved prayer'), explanations: { liturgyPartId: 11,
  items: normalizeExplanations({ explanations: [{ explanation: { id: 1, title: 'Saved explanation', description: 'Last seen meaning', liturgy_part_id: 11 } }] }) } }, Date.now())!
const preferenceAdapter = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider><PreferencesProvider store={preferenceAdapter}>{children}</PreferencesProvider></ThemeProvider>
let api: jest.Mocked<ReaderApi>, cable: CableCallbacks, network: (active: boolean, online: boolean) => void
beforeEach(() => {
  jest.clearAllMocks()
  ReactNative.Dimensions.set({ window: { width: 402, height: 874, fontScale: 1, scale: 1 }, screen: { width: 402, height: 874, fontScale: 1, scale: 1 } })
  jest.mocked(preferencesStore.set).mockResolvedValue(undefined)
  jest.mocked(preferencesStore.remove).mockResolvedValue(undefined)
  jest.mocked(preferencesStore.get).mockResolvedValue(JSON.stringify(record()))
  api = { services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]), session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockRejectedValue(new Error('offline')), explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]) }
  jest.mocked(createApi).mockReturnValue(api)
  jest.mocked(createCable).mockReturnValue({ subscribe: (_url, _id, cb) => { cable = cb; return () => {} } })
  jest.mocked(lifecycle.listen).mockImplementation(cb => { network = cb; return () => {} })
})
const flush = async () => { await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }) }
const mount = async (id = 7) => { const view = await render(<SessionReader endpoints={endpoints} id={id} back={() => {}} />, { wrapper }); await flush(); return view }
const savedLabel = 'Saved copy — not live. Saved from the last time you read this service. It may be out of date and does not follow the service.'

it('T-09: cold live failure shows saved text with spoken status, no current/follow/live or published saved position', async () => {
  const publish = jest.spyOn(position, 'publishLivePosition')
  try {
    await mount()
    const header = within(screen.getByTestId('reader-header-details'))
    expect(header.getByText('Saved service title')).toBeOnTheScreen()
    expect(header.getByText('Saved church')).toBeOnTheScreen()
    expect(header.queryByText('Session 7')).toBeNull()
    expect(header.queryByText('2026-09-13')).toBeNull()
    expect(screen.getByText('Saved prayer')).toBeOnTheScreen()
    expect(screen.getByText('Saved copy — not live')).toBeOnTheScreen()
    expect(screen.getByLabelText(savedLabel)).toHaveProp('accessibilityLiveRegion', 'polite')
    const labels = screen.getAllByLabelText(/Saved copy — not live|Connection lost/)
    expect(labels[0]).toHaveProp('accessibilityLabel', savedLabel)
    expect(screen.queryByLabelText('Live')).toBeNull()
    expect(screen.queryByText('NOW')).toBeNull()
    expect(screen.queryByRole('button', { name: /, current part/ })).toBeNull()
    expect(jest.mocked(PartList).mock.calls.at(-1)?.[0]).toMatchObject({ parts: record().parts, currentKey: undefined, following: false, paused: false })
    expect(screen.getByText('Showing saved text')).toBeOnTheScreen()
    expect(preferencesStore.set).not.toHaveBeenCalled()
    await fireEvent(screen.getByTestId('reading-list'), 'scrollBeginDrag')
    expect(jest.mocked(PartList).mock.calls.at(-1)?.[0].following).toBe(false)
    for (const [value] of publish.mock.calls) {
      expect(value.parts).toEqual([])
      expect(value.currentKey).toBeUndefined()
      expect(position.movedPast(value, record().parts[0].key)).toBeUndefined()
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Explain saved text' }))
    expect(screen.getByText('Last-seen explanations')).toBeOnTheScreen()
    expect(screen.getByText('Last seen meaning')).toBeOnTheScreen()
    expect(screen.queryByText('Explanations follow the service’s current part, even while you read elsewhere.')).toBeNull()
  } finally { publish.mockRestore() }
})

it.each(['absent', 'corrupt', 'expired', 'different session', 'read failure'])('ordinary failure without saved display: %s', async kind => {
  const value = record()
  if (kind === 'expired') value.savedAt -= SAVED_SERVICE_TTL_MS
  if (kind === 'different session') value.session.id = 8
  jest.mocked(preferencesStore.get).mockResolvedValue(kind === 'absent' ? null : kind === 'corrupt' ? '{' : JSON.stringify(value))
  if (kind === 'read failure') jest.mocked(preferencesStore.get).mockRejectedValue(new Error('disk'))
  await mount()
  expect(screen.getByText('Connection lost')).toBeOnTheScreen()
  expect(screen.queryByText('Saved prayer')).toBeNull()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
  expect(screen.queryByText('Saved service title')).toBeNull()
  expect(screen.queryByText('Saved church')).toBeNull()
})

it('does not flash saved content before the cold live attempt resolves; authoritative recovery wins', async () => {
  let resolve!: (value: ReturnType<typeof parts>) => void
  api.parts.mockImplementation(() => new Promise(r => { resolve = r }))
  await mount()
  expect(screen.getByText('Loading service…')).toBeOnTheScreen()
  expect(screen.queryByText('Saved prayer')).toBeNull()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
  await act(async () => { resolve(parts('Live prayer')) })
  await flush()
  expect(screen.getByText('Live prayer')).toBeOnTheScreen()
  expect(screen.queryByText('Saved prayer')).toBeNull()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
  expect(screen.getByRole('button', { name: 'Choir, current part' })).toBeOnTheScreen()
})

it('successful empty live recovery keeps the ordinary reader despite a matching saved record', async () => {
  let resolve!: (value: ReturnType<typeof parts>) => void
  api.parts.mockImplementation(() => new Promise(r => { resolve = r }))
  const expectNoSavedContent = () => {
    for (const text of ['Saved prayer', 'Saved copy — not live', 'Showing saved text', 'Saved service title', 'Saved church',
      'Last-seen explanations', 'Saved explanation', 'Last seen meaning',
      'Saved explanations from the last time this service was read. They may be out of date and do not follow the service.']) {
      expect(screen.queryByText(text)).toBeNull()
    }
    expect(screen.queryByLabelText(savedLabel)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Explain saved text' })).toBeNull()
    for (const [props] of jest.mocked(PartList).mock.calls) expect(props.parts).toEqual([])
  }
  await mount()
  expect(screen.getByText('Loading service…')).toBeOnTheScreen()
  expect(preferencesStore.get).toHaveBeenCalled()
  expectNoSavedContent()
  await act(async () => { resolve([]) })
  await flush()
  expect(screen.getByText('No reading parts are available for this service.')).toBeOnTheScreen()
  expect(screen.getByText('The current part is not available. You can browse the readings.')).toBeOnTheScreen()
  expect(within(screen.getByTestId('reader-header-details')).getByText(session.title)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Explain current part' })).toBeDisabled()
  expectNoSavedContent()
  await act(async () => { cable.connected() })
  await act(async () => { resolve([]) })
  await flush()
  expect(screen.getByLabelText('Live')).toBeOnTheScreen()
  expectNoSavedContent()
  await act(async () => { cable.disconnected() })
  expect(screen.getByText('Reconnecting')).toBeOnTheScreen()
  expectNoSavedContent()
  await act(async () => { resolve([]) })
  await flush()
  expect(screen.getByText('No reading parts are available for this service.')).toBeOnTheScreen()
  expectNoSavedContent()
})

it('T-10: reconnect replaces saved mode and subsequent loss keeps the existing in-memory path', async () => {
  await mount()
  expect(screen.getByText('Saved prayer')).toBeOnTheScreen()
  expect(within(screen.getByTestId('reader-header-details')).getByText('Saved service title')).toBeOnTheScreen()
  expect(within(screen.getByTestId('reader-header-details')).getByText('Saved church')).toBeOnTheScreen()
  api.parts.mockResolvedValue(parts('Recovered prayer'))
  await fireEvent.press(screen.getByRole('button', { name: 'Return to live' }))
  await act(async () => { cable.connected() })
  await flush()
  expect(screen.getByText('Recovered prayer')).toBeOnTheScreen()
  const header = within(screen.getByTestId('reader-header-details'))
  expect(header.getByText(session.title)).toBeOnTheScreen()
  expect(header.getByText(session.church)).toBeOnTheScreen()
  expect(header.queryByText('Saved service title')).toBeNull()
  expect(header.queryByText('Saved church')).toBeNull()
  expect(screen.getByLabelText('Live')).toBeOnTheScreen()
  expect(screen.getByText('NOW')).toBeOnTheScreen()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
  expect(jest.mocked(PartList).mock.calls.at(-1)?.[0].following).toBe(true)
  await act(async () => { network(true, false) })
  expect(screen.getByText('Recovered prayer')).toBeOnTheScreen()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
})

it('saved explanation absence has an understandable last-seen empty state', async () => {
  jest.mocked(preferencesStore.get).mockResolvedValue(JSON.stringify({ ...record(), explanations: null }))
  await mount()
  await fireEvent.press(screen.getByRole('button', { name: 'Explain saved text' }))
  expect(screen.getByText('No explanation was saved for this service.')).toBeOnTheScreen()
})

it('services-list useReader has no saved read/write path', async () => {
  const { result } = await renderHook(() => useReader(endpoints, null))
  await flush()
  expect(result.current.saved).toBeNull()
  expect(preferencesStore.get).not.toHaveBeenCalled()
  expect(preferencesStore.set).not.toHaveBeenCalled()
  expect(preferencesStore.remove).not.toHaveBeenCalled()
})

it('hook uses injected storage/clock and ignores late hydration from an old route', async () => {
  let resolve!: (value: string | null) => void
  const value = record(), now = () => value.savedAt
  const store: KeyValueAdapter = { get: () => new Promise(r => { resolve = r }), set: async () => {}, remove: async () => {} }
  const { result, rerender } = await renderHook((props: unknown) => useSavedService((props as { id: number }).id, store, now), { initialProps: { id: 7 } })
  await flush()
  await rerender({ id: 8 })
  await act(async () => { resolve(JSON.stringify(value)) })
  await flush()
  expect(result.current).toBeNull()
  await act(async () => { resolve(JSON.stringify(value)) })
  await flush()
  expect(result.current).toBeNull()
})

it('T-11: control source remains cache-free and uses only authoritative expectations', () => {
  const root = join(__dirname, '../features/services')
  function check(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) check(file)
      else if (/\.[jt]sx?$/.test(file)) expect(readFileSync(file, 'utf8')).not.toMatch(/offline\/|savedService|useSavedService|\.saved\b/)
    }
  }
  check(root)
})


it('late saved hydration cannot replace an already recovered live reader', async () => {
  let resolve!: (value: string | null) => void
  jest.mocked(preferencesStore.get).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  api.parts.mockResolvedValue(parts('Live prayer'))
  await mount()
  expect(screen.getByText('Live prayer')).toBeOnTheScreen()
  await act(async () => { resolve(JSON.stringify(record())) })
  await flush()
  expect(screen.getByText('Live prayer')).toBeOnTheScreen()
  expect(screen.queryByText('Saved prayer')).toBeNull()
  expect(screen.queryByText('Saved copy — not live')).toBeNull()
})

it.each([
  { width: 402, height: 874, fontScale: 1, scheme: 'dark' as const },
  { width: 1194, height: 834, fontScale: 1, scheme: 'light' as const },
  { width: 402, height: 874, fontScale: 2, scheme: 'light' as const },
])('keeps saved status and retry accessible at $width x $height, scale $fontScale, $scheme', async ({ scheme, ...dimensions }) => {
  ReactNative.Dimensions.set({ window: { ...dimensions, scale: 1 }, screen: { ...dimensions, scale: 1 } })
  await render(<ThemeProvider scheme={scheme}><PreferencesProvider store={preferenceAdapter}>
    <SessionReader endpoints={endpoints} id={7} back={() => {}} />
  </PreferencesProvider></ThemeProvider>)
  await flush()
  expect(screen.getByLabelText(savedLabel)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Return to live' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Explain saved text' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: /, current part/ })).toBeNull()
  expect(jest.mocked(PartList).mock.calls.at(-1)?.[0]).toMatchObject({ following: false, currentKey: undefined })
})

it('keeps the live reading usable while the explanation sheet loads independently', async () => {
  api.parts.mockResolvedValue(parts('Live prayer'))
  let resolve!: (value: ReturnType<typeof normalizeExplanations>) => void
  api.explanations.mockImplementation(() => new Promise(r => { resolve = r }))
  await mount()
  expect(screen.getByText('Live prayer')).toBeOnTheScreen()
  expect(screen.queryByText('Loading service…')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Explain current part' }))
  expect(screen.getByText('Loading the explanation…')).toBeOnTheScreen()
  expect(screen.queryByText('No explanation is available for this part.')).toBeNull()
  await act(async () => { resolve(normalizeExplanations({ explanations: [{ explanation: {
    id: 1, title: 'Live explanation', description: 'Live meaning', liturgy_part_id: 11,
  } }] })) })
  await flush()
  expect(screen.getByText('Live meaning')).toBeOnTheScreen()
  expect(screen.queryByText('Loading the explanation…')).toBeNull()
})
