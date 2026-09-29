import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { Navigator } from '../src/App'
import { I18nProvider } from '../src/i18n'
import { PreferencesProvider } from '../src/preferences'
import { API, endpoints, fakeServer } from './fakeServer'

type Server = ReturnType<typeof fakeServer>
let server: Server
const remote = (eventType: string) => act(async () => { (globalThis as unknown as { remote(e: string): void }).remote(eventType) })
const flush = async () => { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }) }
const badge = () => screen.queryByTestId('freshness-label')?.props.children as string | undefined
const speaker = () => screen.getByTestId('display-speaker').props.children as string

beforeEach(() => { jest.useFakeTimers(); server = fakeServer() })
afterEach(() => { jest.useRealTimers() })

async function renderApp() {
  await render(<I18nProvider initial="en"><PreferencesProvider><Navigator endpoints={endpoints} transport={server.transport} request={server.request as unknown as typeof fetch} /></PreferencesProvider></I18nProvider>)
  await flush()
}

function seedLiturgy() {
  // Part 11 is reused: two occurrences with one part ID, told apart only by liturgy_part_id.
  server.addService({ id: 7, church: 'St. John Armenian Church', title: 'Divine Liturgy', status: 'active' }, [
    { id: 10, liturgyPartId: 100, position: 1, role: 'priest', en: 'Blessed is the kingdom.', translit: 'Orhnyal takavorutyun', grabar: 'Օրհնեալ թագաւորութիւն', page: 4 },
    { id: 11, liturgyPartId: 101, position: 2, role: 'deacon', en: 'Lord, have mercy.', translit: 'Ter voghormya' },
    { id: 12, liturgyPartId: 102, position: 3, role: 'choir', en: 'Holy God, holy and mighty.', translit: 'Surb Astvats' },
    { id: 11, liturgyPartId: 103, position: 4, role: 'people', en: 'Lord, have mercy.', translit: 'Ter voghormya' },
  ], 100)
}
async function openService(id = 7) {
  await fireEvent.press(screen.getByTestId(`service-${id}`))
  await act(async () => { server.connected(id) }); await flush()
}

describe('service selection', () => {
  it('shows live services with a separate display-setup entry', async () => {
    seedLiturgy()
    await renderApp()
    expect(screen.getByTestId('service-7').props.accessibilityLabel).toBe('Divine Liturgy, St. John Armenian Church')
    await fireEvent.press(screen.getByTestId('display-setup'))
    await flush()
    expect(screen.getByTestId('churches-empty')).toBeTruthy()
  })
  it('shows no-services and failure states, retries, and refreshes while open', async () => {
    server.failServices(true)
    await renderApp()
    expect(screen.getByTestId('services-failed')).toBeTruthy()
    server.failServices(false)
    await fireEvent.press(screen.getByTestId('services-retry'))
    await flush()
    expect(screen.getByTestId('services-empty')).toBeTruthy()
    seedLiturgy()
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) }); await flush()
    expect(screen.getByTestId('service-7')).toBeTruthy()
  })
})

describe('session display', () => {
  it('projects the live part like mobile, follows repeated occurrences, recovers, ends, and only reads', async () => {
    seedLiturgy()
    await renderApp()
    await openService()
    // Mobile's defaults: parallel transliteration and English, the current part's speaker above.
    expect(screen.getByTestId('display-projection')).toBeTruthy()
    expect(speaker()).toBe('priest')
    expect(within(screen.getByTestId('display-column-translit')).getByText('Orhnyal takavorutyun')).toBeTruthy()
    expect(within(screen.getByTestId('display-column-en')).getByText('Blessed is the kingdom.')).toBeTruthy()
    expect(badge()).toBeUndefined() // Live: nothing covers the projection.
    expect(activateKeepAwakeAsync).toHaveBeenCalled()

    // The operator advances to the second "Lord, have mercy": same part ID 11, a different occurrence.
    for (const next of [101, 102, 103]) { await act(async () => { server.advance(7, next) }); await flush() }
    expect(speaker()).toBe('people')

    // The connection drops: the text stays but is marked, then recovers to a clean projection.
    await act(async () => { server.disconnected(7) }); await flush()
    expect(badge()).toBe('Reconnecting')
    await act(async () => { server.connected(7) }); await flush()
    expect(badge()).toBeUndefined()

    // The service leaves the live list: the display says so and lets the TV sleep.
    server.unlist(7)
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) }); await flush()
    expect(badge()).toBe('Service ended')
    expect(deactivateKeepAwake).toHaveBeenCalled()

    // No operator mutations: every request was a GET to a public read endpoint.
    expect(server.requests.length).toBeGreaterThan(5)
    for (const { url, method } of server.requests) {
      expect(method).toBe('GET')
      expect(url.slice(API.length)).toMatch(/^\/(services\.json\?tz=|s\/7(\.json|\/parts\.json|\/state\.json)$)/)
    }
  })

  it('shows status messages and the read-along QR code', async () => {
    seedLiturgy()
    await renderApp()
    await openService()
    await act(async () => { server.setStatus(7, 'paused') }); await flush()
    expect(screen.getByText('Service paused')).toBeTruthy()
    await act(async () => { server.setStatus(7, 'showing_session_qr') }); await flush()
    expect(screen.getByTestId('display-session-qr')).toBeTruthy()
    expect(screen.getByText('https://web.tarkman.app/sessions/7/parts')).toBeTruthy()
  })

  it('scrolls the current reading by remote until the next reading, never moving the service', async () => {
    seedLiturgy()
    await renderApp()
    await openService()
    const before = server.requests.length
    await remote('down')
    // Nothing to scroll in a short reading: remote Down does nothing rather than pretending.
    expect(screen.queryByTestId('display-scroll-hint')).toBeNull()
    await fireEvent(screen.getAllByTestId('projection-text-scroll')[0], 'layout', { nativeEvent: { layout: { width: 800, height: 200 } } })
    await fireEvent(screen.getAllByTestId('projection-text-scroll')[0], 'contentSizeChange', 800, 1400)
    await remote('down')
    expect(screen.getByTestId('display-scroll-hint')).toBeTruthy()
    await act(async () => { server.advance(7, 101) }); await flush()
    expect(screen.queryByTestId('display-scroll-hint')).toBeNull()
    expect(server.requests.slice(before).every(r => r.method === 'GET')).toBe(true)
  })

  it('opens display options with Select, changes languages and layout, and Menu closes them', async () => {
    const menu: Parameters<typeof BackHandler.addEventListener>[1][] = []
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => { menu.unshift(handler); return { remove: () => { menu.splice(menu.indexOf(handler), 1) } } })
    seedLiturgy()
    await renderApp()
    await openService()
    await remote('select')
    expect(screen.getByTestId('display-options')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('option-mode-single'))
    await fireEvent.press(screen.getByTestId('option-lang1-grabar'))
    expect(screen.queryByTestId('display-column-en')).toBeNull()
    expect(within(screen.getByTestId('display-column-grabar')).getByText('Օրհնեալ թագաւորութիւն')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('option-status-pages_only'))
    expect(screen.getByTestId('display-page').props.children).toBe('4')
    // Menu closes the options first, and only then leaves the display.
    await act(async () => { menu[0]({ eventType: 'menu' } as never) }); await flush()
    expect(screen.queryByTestId('display-options')).toBeNull()
    expect(screen.getByTestId('display-status')).toBeTruthy()
    await act(async () => { menu[0]({ eventType: 'menu' } as never) }); await flush()
    expect(screen.getByTestId('service-7').props.hasTVPreferredFocus).toBe(true)
    expect(server.subscribed(7)).toBe(false)
    spy.mockRestore()
  })

  it('switching services never shows the previous one', async () => {
    seedLiturgy()
    server.addService({ id: 8, church: 'Holy Cross', title: 'Vespers', status: 'active' }, [{ id: 20, liturgyPartId: 200, position: 1, role: 'choir', en: 'Evening hymn.', translit: 'Yerekoyan' }])
    await renderApp()
    await openService(7)
    await remote('select')
    await fireEvent.press(screen.getByTestId('options-back'))
    await openService(8)
    expect(speaker()).toBe('choir')
    expect(screen.queryByText('Blessed is the kingdom.')).toBeNull()
  })
})

describe('settings', () => {
  it('sets display options before opening a service and switches the interface to Russian', async () => {
    seedLiturgy()
    await renderApp()
    await fireEvent.press(screen.getByTestId('open-settings'))
    await fireEvent.press(screen.getByTestId('option-lang1-en'))
    await fireEvent.press(screen.getByTestId('option-mode-single'))
    await fireEvent.press(screen.getByTestId('setting-interface-ru'))
    expect(screen.getByText('Настройки')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('settings-done'))
    await openService()
    expect(screen.queryByTestId('display-column-translit')).toBeNull()
    expect(within(screen.getByTestId('display-column-en')).getByText('Blessed is the kingdom.')).toBeTruthy()
    await act(async () => { server.setStatus(7, 'paused') }); await flush()
    expect(screen.getByText('Богослужение приостановлено')).toBeTruthy()
  })
})
