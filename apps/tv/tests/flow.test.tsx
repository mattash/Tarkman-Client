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
const flush = async () => { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }) }
const label = () => screen.getByTestId('freshness-label').props.children as string

beforeEach(() => { jest.useFakeTimers(); server = fakeServer() })
afterEach(() => { jest.useRealTimers() })

async function renderApp() {
  await render(<I18nProvider initial="en"><PreferencesProvider initialLanguage="en"><Navigator endpoints={endpoints} transport={server.transport} /></PreferencesProvider></I18nProvider>)
  await flush()
}

function seedLiturgy() {
  // Part 11 is reused: two occurrences with one part ID, told apart only by liturgy_part_id.
  server.addService({ id: 7, church: 'St. John Armenian Church', title: 'Divine Liturgy', status: 'active' }, [
    { id: 10, liturgyPartId: 100, position: 1, en: 'Blessed is the kingdom.', grabar: 'Օրհնեալ թագաւորութիւն' },
    { id: 11, liturgyPartId: 101, position: 2, en: 'Lord, have mercy.' },
    { id: 12, liturgyPartId: 102, position: 3, en: 'Holy God, holy and mighty.' },
    { id: 11, liturgyPartId: 103, position: 4, en: 'Lord, have mercy.' },
  ], 100)
}

describe('service selection', () => {
  it('shows loading, then live services with a separate display-setup entry', async () => {
    seedLiturgy()
    await renderApp()
    expect(screen.getByTestId('service-7').props.accessibilityLabel).toBe('Divine Liturgy, St. John Armenian Church')
    expect(screen.getByTestId('display-setup')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('display-setup'))
    expect(screen.getByTestId('display-setup-body')).toBeTruthy()
  })
  it('shows no-services and failure states, and retries', async () => {
    server.failServices(true)
    await renderApp()
    expect(screen.getByTestId('services-failed')).toBeTruthy()
    server.failServices(false)
    await fireEvent.press(screen.getByTestId('services-retry'))
    await flush()
    expect(screen.getByTestId('services-empty')).toBeTruthy()
    seedLiturgy()
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) })
    await flush()
    expect(screen.getByTestId('service-7')).toBeTruthy()
  })
})

describe('reader', () => {
  it('follows the live cursor through repeated occurrences, disconnects, recovers and ends, reading only', async () => {
    seedLiturgy()
    await renderApp()
    await fireEvent.press(screen.getByTestId('service-7'))
    await flush()
    expect(server.subscribed(7)).toBe(true)
    await act(async () => { server.connected(7) }); await flush()
    expect(label()).toBe('Live')
    const marker = () => screen.getAllByTestId('current-marker')
    expect(marker()).toHaveLength(1)
    expect(within(screen.getByTestId('part-lp:100')).queryByTestId('current-marker')).toBeTruthy()
    expect(activateKeepAwakeAsync).toHaveBeenCalled()

    // The operator moves to the second "Lord, have mercy": same part ID 11, different occurrence.
    await act(async () => { server.advance(7, 101) }); await flush()
    await act(async () => { server.advance(7, 102) }); await flush()
    await act(async () => { server.advance(7, 103) }); await flush()
    expect(within(screen.getByTestId('part-lp:103')).queryByTestId('current-marker')).toBeTruthy()
    expect(within(screen.getByTestId('part-lp:101')).queryByTestId('current-marker')).toBeNull()
    expect(label()).toBe('Live')

    // The connection drops: the text stays but is no longer claimed live.
    await act(async () => { server.disconnected(7) }); await flush()
    expect(label()).toBe('Reconnecting')
    await act(async () => { server.connected(7) }); await flush()
    expect(label()).toBe('Live')

    // The service leaves the live list: the reader says it ended and lets the TV sleep.
    server.unlist(7)
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) }); await flush()
    expect(label()).toBe('Service ended')
    expect(deactivateKeepAwake).toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('reader-back'))
    await flush()
    expect(screen.getByTestId('services-empty')).toBeTruthy()

    // No operator mutations: every request was a GET to a public read endpoint.
    expect(server.requests.length).toBeGreaterThan(5)
    for (const { url, method } of server.requests) {
      expect(method).toBe('GET')
      expect(url.slice(API.length)).toMatch(/^\/(services\.json\?tz=|s\/7(\.json|\/parts\.json|\/state\.json)$)/)
    }
  })

  it('suspends following for local reading and returns to live without touching the cursor', async () => {
    seedLiturgy()
    await renderApp()
    await fireEvent.press(screen.getByTestId('service-7'))
    await act(async () => { server.connected(7) }); await flush()
    expect(screen.queryByTestId('return-to-live')).toBeNull()

    // The viewer moves down to a later part with the remote.
    await fireEvent(screen.getByTestId('block-lp:102#0'), 'focus')
    expect(screen.getByTestId('return-to-live')).toBeTruthy()
    expect(screen.getByTestId('reading-manually')).toBeTruthy()
    const before = server.requests.length
    await act(async () => { server.advance(7, 101) }); await flush()
    // Still reading locally: the live marker moved, the viewer's place did not, and nothing was written.
    expect(within(screen.getByTestId('part-lp:101')).queryByTestId('current-marker')).toBeTruthy()
    expect(server.requests.slice(before).every(r => r.method === 'GET')).toBe(true)

    await fireEvent.press(screen.getByTestId('return-to-live'))
    await flush()
    expect(screen.queryByTestId('return-to-live')).toBeNull()
    expect(label()).toBe('Live')
  })

  it('shows service status, missing languages and switches reading language', async () => {
    seedLiturgy()
    await renderApp()
    await fireEvent.press(screen.getByTestId('service-7'))
    await act(async () => { server.connected(7) }); await flush()
    await fireEvent.press(screen.getByTestId('language-grabar'))
    expect(screen.getByText('Օրհնեալ թագաւորութիւն')).toBeTruthy()
    expect(screen.getAllByText('Not available in Classical Armenian.').length).toBe(3)
    await act(async () => { server.setStatus(7, 'paused') }); await flush()
    expect(label()).toBe('Service paused')
  })

  it('Menu goes back with focus on the last service, and a new service never shows the previous one', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1]
    const menu: Handler[] = []
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => { menu.push(handler); return { remove: () => { menu.splice(menu.indexOf(handler), 1) } } })
    seedLiturgy()
    server.addService({ id: 8, church: 'Holy Cross', title: 'Vespers', status: 'active' }, [{ id: 20, liturgyPartId: 200, position: 1, en: 'Evening hymn.' }])
    await renderApp()
    expect(menu).toHaveLength(0) // At the root, Menu belongs to tvOS: it leaves the app.
    await fireEvent.press(screen.getByTestId('service-7'))
    await act(async () => { server.connected(7) }); await flush()
    await act(async () => { server.disconnected(7) })
    expect(menu).toHaveLength(1)
    await act(async () => { menu[0]({ eventType: 'menu' } as unknown as Parameters<Handler>[0]) }); await flush()
    expect(server.subscribed(7)).toBe(false) // Leaving stops the subscription.
    expect(screen.getByTestId('service-7').props.hasTVPreferredFocus).toBe(true)
    expect(screen.getByTestId('service-8').props.hasTVPreferredFocus).toBe(false)
    await fireEvent.press(screen.getByTestId('service-8'))
    await flush()
    expect(screen.getByTestId('reader-church').props.children).toBe('Holy Cross')
    expect(screen.queryByText('Blessed is the kingdom.')).toBeNull()
    spy.mockRestore()
  })
})

describe('settings', () => {
  it('switches interface language, reading language and text size', async () => {
    seedLiturgy()
    await renderApp()
    await fireEvent.press(screen.getByTestId('open-settings'))
    await fireEvent.press(screen.getByTestId('setting-interface-ru'))
    expect(screen.getByText('Настройки')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('setting-reading-grabar'))
    await fireEvent.press(screen.getByTestId('setting-size-large'))
    expect(screen.getByTestId('setting-size-large').props.accessibilityState).toMatchObject({ selected: true })
    await fireEvent.press(screen.getByTestId('settings-done'))
    await fireEvent.press(screen.getByTestId('service-7'))
    await act(async () => { server.connected(7) }); await flush()
    expect(screen.getByText('Օրհնեալ թագաւորութիւն').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 56 })]))
    expect(label()).toBe('Идёт')
  })
})
