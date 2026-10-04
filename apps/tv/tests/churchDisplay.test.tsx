import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import type { KeyValueAdapter } from '@tarkman/core'
import { Launch } from '../src/App'
import { I18nProvider } from '../src/i18n'
import { PreferencesProvider } from '../src/preferences'
import { SavedDisplayProvider } from '../src/saved'
import { newSavedDisplay, SAVED_DISPLAY_KEY } from '../src/savedDisplay'
import { memoryStore } from '../src/storage'
import { endpoints, fakeServer } from './fakeServer'

type Server = ReturnType<typeof fakeServer>
let server: Server
const remote = (eventType: string) => act(async () => { (globalThis as unknown as { remote(e: string): void }).remote(eventType) })
const flush = async () => { await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }) }
const tick = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms) }); await flush() }
const press = async (testID: string) => { await fireEvent.press(screen.getByTestId(testID)); await flush() }
const has = (testID: string) => screen.queryByTestId(testID) !== null
const speaker = () => screen.getByTestId('display-speaker').props.children as string

const CHURCH = { id: 'c1', name: 'St. John Armenian Church', locality: 'Southfield, MI' }
const savedRecord = (token = 'tok1', linkId = 'l1', title = 'Sanctuary') => newSavedDisplay(CHURCH, { id: linkId, title, token }, 1_800_000_000_000)
const stored = (store: ReturnType<typeof memoryStore>) => JSON.parse(store.data.get(SAVED_DISPLAY_KEY) ?? 'null') as ReturnType<typeof savedRecord> | null
const savedStore = (token?: string) => memoryStore({ [SAVED_DISPLAY_KEY]: JSON.stringify(savedRecord(token)) })

beforeEach(() => { jest.useFakeTimers(); server = fakeServer() })
afterEach(() => { jest.useRealTimers() })

function seed() {
  const parts = (base: number) => [
    { id: base, liturgyPartId: base * 10, position: 1, role: 'priest', en: 'Blessed is the kingdom.', translit: 'Orhnyal takavorutyun' },
    { id: base + 1, liturgyPartId: base * 10 + 1, position: 2, role: 'deacon', en: 'Lord, have mercy.', translit: 'Ter voghormya' },
  ]
  server.addService({ id: 7, church: CHURCH.name, title: 'Divine Liturgy', status: 'active' }, parts(10), 100)
  server.addService({ id: 8, church: CHURCH.name, title: 'Evening Service', status: 'active' }, parts(20), 200)
  server.setCurrentService(5, null)
  server.addChurch(CHURCH, [{ id: 'l1', title: 'Sanctuary', token: 'tok1', userId: 5 }, { id: 'l2', title: 'Fellowship hall', token: 'tok2', userId: 5 }])
  server.addChurch({ id: 'c2', name: 'Holy Cross', locality: null }, [])
}

async function launch<S extends KeyValueAdapter = ReturnType<typeof memoryStore>>(store: S = memoryStore() as unknown as S, request: unknown = server.request) {
  const view = await render(
    <I18nProvider initial="en"><PreferencesProvider><SavedDisplayProvider store={store}>
      <Launch endpoints={endpoints} transport={server.transport} request={request as typeof fetch} />
    </SavedDisplayProvider></PreferencesProvider></I18nProvider>)
  await flush()
  return { view, store }
}
/** A service begins for the church's operator and the display follows it. */
async function startService(id: number, userId = 5) {
  server.setCurrentService(userId, id)
  await tick(5000)
  await act(async () => { server.connected(id) }); await flush()
}

describe('setup', () => {
  it('sets up a church display with no sign-in, stores only public identity, and opens it directly on relaunch', async () => {
    seed()
    const { view, store } = await launch()
    expect(has('display-setup')).toBe(true) // the unconfigured home screen offers setup beside the live services
    await press('display-setup')
    // Churches without a live service are listed, and only the allowlisted fields reach the screen.
    expect(has('church-c1') && has('church-c2')).toBe(true)
    expect(screen.queryByText(/must not surface/)).toBeNull()
    await press('church-c1')
    expect(has('link-l1') && has('link-l2')).toBe(true)
    await press('link-l1')

    expect(stored(store)).toMatchObject({ version: 1, church: { id: 'c1' }, link: { id: 'l1', token: 'tok1' } })
    expect(store.data.get(SAVED_DISPLAY_KEY)).not.toMatch(/session|"id":7/)
    expect(has('display-link-waiting')).toBe(true) // no service is live: waiting, not an invalid default
    await startService(7)
    expect(speaker()).toBe('priest')

    // Relaunch: hydration decides the first screen, and setup never flashes.
    await view.unmount()
    await launch(store)
    expect(has('display-setup') || has('churches-empty') || has('service-7')).toBe(false)
    await startService(7)
    expect(speaker()).toBe('priest')
    expect(stored(store)?.link.token).toBe('tok1')
    expect(server.requests.every(request => request.method === 'GET')).toBe(true)
  })

  it('shows blank until storage has been read, never a guessed route', async () => {
    seed()
    let release: (value: string | null) => void = () => {}
    const slow = { get: () => new Promise<string | null>(resolve => { release = resolve }), set: async () => {}, remove: async () => {} }
    await render(<I18nProvider initial="en"><PreferencesProvider><SavedDisplayProvider store={slow}>
      <Launch endpoints={endpoints} transport={server.transport} request={server.request as unknown as typeof fetch} />
    </SavedDisplayProvider></PreferencesProvider></I18nProvider>)
    expect(has('launch-loading')).toBe(true)
    expect(has('display-setup')).toBe(false)
    await act(async () => { release(JSON.stringify(savedRecord())) }); await flush()
    expect(has('launch-loading')).toBe(false)
    expect(has('display-link-waiting')).toBe(true)
  })

  it('lists, searches and pages churches, with distinct empty, no-match and failure states', async () => {
    seed()
    for (let i = 0; i < 25; i++) server.addChurch({ id: `x${i}`, name: `Extra ${i}`, locality: 'Town' })
    await launch()
    await press('display-setup')
    expect(has('church-c1') && has('churches-more')).toBe(true)
    expect(has('church-x19')).toBe(false)
    await press('churches-more')
    expect(has('church-x19') && has('church-x24')).toBe(true)
    expect(has('churches-more')).toBe(false)

    await fireEvent.changeText(screen.getByTestId('churches-query'), 'holy')
    await press('churches-search')
    expect(has('church-c2')).toBe(true)
    expect(has('church-c1')).toBe(false)
    await fireEvent.changeText(screen.getByTestId('churches-query'), 'zzz')
    await press('churches-search')
    expect(has('churches-no-matches')).toBe(true) // distinct from an empty directory
    await press('churches-clear')
    expect(has('church-c1')).toBe(true)

    server.failDirectory(true)
    await fireEvent.changeText(screen.getByTestId('churches-query'), 'st')
    await press('churches-search')
    expect(has('churches-failed')).toBe(true)
    server.failDirectory(false)
    await press('churches-retry')
    expect(has('church-c1')).toBe(true)
  })

  it('distinguishes an empty directory, a church with no displays, and an unavailable display', async () => {
    await launch()
    await press('display-setup')
    expect(has('churches-empty')).toBe(true)
    await press('churches-back')

    seed()
    await press('display-setup')
    await press('church-c2')
    expect(has('links-empty')).toBe(true)
    await press('links-back')
    await press('church-c1')
    server.setLinkStatus('tok1', 404) // revoked between listing and choosing
    await press('link-l1')
    expect(has('link-problem-unavailable')).toBe(true)
    expect(has('display-link-waiting')).toBe(false)
  })

  it('keeps the previous display when a save cannot be confirmed, and says so', async () => {
    seed()
    const inner = savedStore('tok2')
    const lossy = { get: inner.get, remove: inner.remove, set: async () => {} }
    await launch(lossy)
    await press('waiting-change')
    await press('church-c1')
    await press('link-l1')
    expect(has('link-problem-saveFailed')).toBe(true)
    expect(stored(inner)?.link.token).toBe('tok2')
    expect(has('links-back')).toBe(true) // still in setup, not on a display that was never saved
  })

  it('backing out of setup keeps the old choice, and browsing another service never replaces it', async () => {
    seed()
    const store = savedStore('tok1')
    await launch(store)
    await press('waiting-change')
    await press('church-c1')
    expect(screen.getByTestId('links-replaces')).toBeTruthy()
    await press('links-back')
    await press('churches-back')
    expect(has('display-link-waiting')).toBe(true)
    expect(stored(store)?.link.token).toBe('tok1')

    await press('waiting-services')
    await press('display-setup') // the services list is pushed above the display, not a replacement
    await press('churches-back')
    expect(stored(store)?.link.token).toBe('tok1')
  })

  it('replaces the saved display only when another is explicitly chosen', async () => {
    seed()
    const store = savedStore('tok1')
    await launch(store)
    await press('waiting-change')
    await press('church-c1')
    await press('link-l2')
    expect(stored(store)?.link).toEqual({ id: 'l2', title: 'Fellowship hall', token: 'tok2' })
    expect(has('display-link-waiting')).toBe(true)
    expect(has('links-back')).toBe(false) // the flow is gone: Back cannot return into it
  })
})

describe('following', () => {
  it('waits when no service is live, follows each service, and keeps the default through rollover', async () => {
    seed()
    const store = savedStore()
    await launch(store)
    expect(has('display-link-waiting')).toBe(true)
    await startService(7)
    expect(speaker()).toBe('priest')
    server.setCurrentService(5, null)
    await tick(5000)
    expect(has('display-link-waiting')).toBe(true) // the service ended; the display stays configured
    await startService(8)
    expect(speaker()).toBe('priest')
    expect(stored(store)?.link.token).toBe('tok1')
  })

  it('retains the saved display through network failure and recovers on its own', async () => {
    seed()
    const store = savedStore()
    server.failCurrent(true)
    await launch(store)
    expect(has('display-link-discovery-failed')).toBe(true)
    expect(has('waiting-change')).toBe(true) // still reachable from an error screen
    expect(stored(store)?.link.token).toBe('tok1')
    server.failCurrent(false)
    await tick(5000)
    expect(has('display-link-waiting')).toBe(true)
    await startService(7)
    expect(speaker()).toBe('priest')
  })

  it('adopts a revisioned configuration update while a service is showing', async () => {
    seed()
    await launch(savedStore())
    await startService(7)
    expect(has('display-column-translit') && has('display-column-en')).toBe(true)
    await act(async () => { server.updateLink('tok1', { mode: 'single', lang1: 'en', lang2: null }) }); await flush()
    expect(has('display-column-en')).toBe(true)
    expect(has('display-column-translit')).toBe(false)
  })

  it('shows nothing but the display; Back opens a management screen where reset needs a confirmation', async () => {
    const back: Parameters<typeof BackHandler.addEventListener>[1][] = []
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => { back.unshift(handler); return { remove: () => { back.splice(back.indexOf(handler), 1) } } })
    seed()
    const store = savedStore()
    await launch(store)
    await startService(7)
    expect(has('display-projection')).toBe(true)
    // No chrome: no toolbar, hint, badge or options, and Select does nothing.
    await remote('select')
    for (const id of ['saved-display-toolbar', 'display-menu-hint', 'display-options', 'saved-display-manage', 'display-scroll-hint']) expect(has(id)).toBe(false)

    await act(async () => { back[0]({ eventType: 'menu' } as never) }); await flush()
    expect(has('saved-display-manage')).toBe(true)
    expect(screen.getByTestId('saved-display-current').props.children).toBe('Sanctuary · St. John Armenian Church')
    await press('manage-reset')
    expect(has('manage-reset-confirm')).toBe(true)
    await press('manage-reset-cancel')
    expect(stored(store)?.link.token).toBe('tok1') // cancelling changes nothing
    await act(async () => { back[0]({ eventType: 'menu' } as never) }); await flush()
    expect(has('display-projection')).toBe(true) // Back from the management screen returns to the display

    await act(async () => { back[0]({ eventType: 'menu' } as never) }); await flush()
    await press('manage-reset')
    await press('manage-reset-yes')
    expect(stored(store)).toBeNull()
    expect(has('display-setup')).toBe(true) // back to the unconfigured home screen
  })

  it('stays read-only: no request is ever anything but a GET', async () => {
    seed()
    await launch(savedStore())
    await startService(7)
    await act(async () => { server.updateLink('tok1', { font_scale: 125 }) }); await flush()
    expect(server.requests.length).toBeGreaterThan(3)
    expect(server.requests.every(request => request.method === 'GET')).toBe(true)
  })
})

describe('setup cancellation', () => {
  it('backing out while a display is being checked never saves it or changes screen', async () => {
    seed()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const slow = (input: RequestInfo | URL, init?: RequestInit) => String(input).includes('/display_links/tok1') ? gate.then(() => server.request(input, init)) : server.request(input, init)
    const { store } = await launch(memoryStore(), slow)
    await press('display-setup')
    await press('church-c1')
    await press('link-l1') // the check hangs
    await press('links-back')
    expect(has('church-c1')).toBe(true)
    await act(async () => { release() }); await flush()
    expect(stored(store)).toBeNull()
    expect(has('church-c1')).toBe(true) // still on the church list, nothing navigated
  })
})

describe('unavailable and unreadable', () => {
  it('shows an unavailable display with retry, change and reset, and preserves the saved identity', async () => {
    seed()
    const store = savedStore()
    server.setLinkStatus('tok1', 404)
    await launch(store)
    expect(has('display-link-unavailable')).toBe(true)
    expect(has('unavailable-retry') && has('unavailable-change') && has('unavailable-reset')).toBe(true)
    expect(stored(store)?.link.token).toBe('tok1')

    await press('unavailable-retry')
    expect(has('display-link-unavailable')).toBe(true)
    server.setLinkStatus('tok1', 200)
    await press('unavailable-retry')
    await tick(0)
    expect(has('display-link-waiting')).toBe(true)
  })

  it('reports an expired link differently, and Back from setup returns to it', async () => {
    seed()
    const store = savedStore()
    server.setLinkStatus('tok1', 410)
    await launch(store)
    expect(screen.getByText(/has expired/)).toBeTruthy()
    await press('unavailable-change')
    await press('churches-back')
    expect(has('display-link-unavailable')).toBe(true)
    expect(stored(store)?.link.token).toBe('tok1')
  })

  it('resets deliberately from the unavailable screen', async () => {
    seed()
    const store = savedStore()
    server.setLinkStatus('tok1', 404)
    await launch(store)
    await press('unavailable-reset')
    await press('unavailable-reset-yes')
    expect(stored(store)).toBeNull()
    expect(has('display-setup')).toBe(true)
  })

  it('explains a damaged record, leaves it in place, and never erases it by browsing', async () => {
    seed()
    const store = memoryStore({ [SAVED_DISPLAY_KEY]: '{oops' })
    await launch(store)
    expect(screen.getByTestId('saved-problem-reason').props.children).toMatch(/damaged/)
    expect(store.data.get(SAVED_DISPLAY_KEY)).toBe('{oops')
    await press('problem-services')
    expect(has('display-setup')).toBe(true)
    expect(store.data.get(SAVED_DISPLAY_KEY)).toBe('{oops')
  })

  it('names a record from a newer app, and choosing again overwrites it', async () => {
    seed()
    const store = memoryStore({ [SAVED_DISPLAY_KEY]: JSON.stringify({ ...savedRecord(), version: 2 }) })
    await launch(store)
    expect(screen.getByTestId('saved-problem-reason').props.children).toMatch(/newer version/)
    await press('problem-setup')
    await press('church-c1')
    await press('link-l1')
    expect(stored(store)?.version).toBe(1)
    expect(has('display-link-waiting')).toBe(true)
  })

  const flakyStore = () => {
    const base = savedStore()
    const control = { failing: true }
    const flaky: KeyValueAdapter & { data: Map<string, string> } = {
      data: base.data, set: base.set, remove: base.remove,
      get: async key => { if (control.failing) throw new Error('keychain locked'); return base.get(key) },
    }
    return { base, control, flaky }
  }

  it('treats a storage read failure as retryable and never offers to erase or replace the record', async () => {
    seed()
    const { base, control, flaky } = flakyStore()
    await launch(flaky)
    expect(has('problem-retry')).toBe(true)
    expect(has('problem-erase') || has('problem-setup')).toBe(false)
    expect(stored(base)?.link.token).toBe('tok1') // untouched
    control.failing = false
    await press('problem-retry')
    expect(has('display-link-waiting')).toBe(true) // the saved display opened
  })

  it('recovers from a storage read failure by itself, with nobody at the TV', async () => {
    seed()
    const { control, flaky } = flakyStore()
    await launch(flaky)
    expect(has('problem-retry')).toBe(true)
    control.failing = false
    await tick(30_000)
    expect(has('display-link-waiting')).toBe(true)
  })

  it('erases an unreadable record only after a confirmed reset', async () => {
    seed()
    const store = memoryStore({ [SAVED_DISPLAY_KEY]: 'garbage' })
    await launch(store)
    await press('problem-erase')
    await press('problem-erase-cancel')
    expect(store.data.get(SAVED_DISPLAY_KEY)).toBe('garbage')
    await press('problem-erase')
    await press('problem-erase-yes')
    expect(store.data.has(SAVED_DISPLAY_KEY)).toBe(false)
    expect(has('display-setup')).toBe(true)
  })
})

it('renders Eastern Armenian from a saved display link and applies language updates', async () => {
  seed()
  server.addService({ id: 9, church: CHURCH.name, title: 'Divine Liturgy', status: 'active' }, [
    { id: 30, liturgyPartId: 300, position: 1, en: 'Alleluia', hy_east: 'Ալելուիա', hy_west: 'Western only' },
  ], 300)
  server.updateLink('tok1', { mode: 'single', lang1: 'hye' })
  await launch(savedStore())
  await startService(9)
  expect(screen.getByText('Ալելուիա')).toBeOnTheScreen()
  expect(screen.getByText('Ալելուիա')).toHaveStyle({ fontFamily: 'NotoSerifArmenian-Regular' })
  expect(screen.queryByText('Western only')).toBeNull()
  await act(async () => server.updateLink('tok1', { lang1: 'hyw' }))
  await flush()
  expect(screen.getByText('Western only')).toBeOnTheScreen()
  expect(screen.queryByText('Ալելուիա')).toBeNull()
})
