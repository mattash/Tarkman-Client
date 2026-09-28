import { expect, it, jest } from '@jest/globals'
import { Slot } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import SignedInLayout from '../app/(signed-in)/_layout'
import MyServicesScreen from '../app/(signed-in)/services'
import NewSessionScreen from '../app/(signed-in)/session-management/new'
import { ThemeProvider } from '../design/ThemeProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AUTH_KEY } from '../features/auth/session'
import { todayIn } from '../features/services/management/draft'
import { clearMutations } from '../features/services/management/mutations'
import { API, fakeApi, memoryStore, respond, storedAuth } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-00000000c0de') }))

const LIST = 'GET /s.json?pagination=cursor&limit=20'
const CATALOG = 'GET /s/liturgy_options.json?limit=50'
const CATALOG_2 = 'GET /s/liturgy_options.json?limit=50&after_id=202'
/** Opens the Add Liturgy sheet and picks one liturgy from it. */
async function pick(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Liturgy' }))
  await fireEvent.press(await screen.findByRole('button', { name: `Add ${name}` }))
}
const listed = (ids: number[]) => ({ sessions: ids.map(id => ({ session: { id, liturgy: `Service ${id}`, date: '2030-10-04' } })), page: { limit: 20, has_more: false, next_cursor: null } })

async function renderApp(request: typeof fetch, initialUrl = '/services') {
  clearMutations()
  const { store } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const app = renderRouter({
    _layout: () => <ThemeProvider scheme="light"><AuthProvider apiBase={API} store={store} request={request}><Slot /></AuthProvider></ThemeProvider>,
    '(signed-in)/_layout': SignedInLayout,
    '(signed-in)/services': MyServicesScreen,
    '(signed-in)/session-management/new': NewSessionScreen,
    '(signed-in)/services/[id]': () => null,
  }, { initialUrl })
  await app
  return { getPathname: app.getPathname }
}

it.each([
  ['empty', () => respond(200, { error: 'No sessions found' })],
  ['failed', () => respond(500)],
  ['listed', () => respond(200, listed([7]))],
])('puts Add Session above the list when it is %s', async (_, list) => {
  await renderApp(fakeApi({ [LIST]: list }))
  const add = await screen.findByRole('button', { name: 'Add Session' })
  await waitFor(() => expect(screen.queryByLabelText('Loading your sessions')).toBeNull())
  // Matches come back in tree order: the action precedes every list state and card.
  const order = screen.getAllByText(/^(Add Session|Service 7|Could not load your sessions\. Please retry\.|No sessions yet)$/).map(node => node.props.children)
  expect(order).toHaveLength(2)
  expect(order[0]).toBe('Add Session')
  expect(add).toBeOnTheScreen()
})

it('creates a session in the chosen order, returns to My Sessions, and offers Open controls', async () => {
  let lists = 0
  const request = fakeApi({
    [LIST]: () => respond(200, listed(++lists === 1 ? [] : [4008])),
    'GET /s/new.json': () => respond(200, fixtures.bootstrap),
    [CATALOG]: () => respond(200, fixtures.liturgyPage1),
    [CATALOG_2]: () => respond(200, fixtures.liturgyPage2),
    'POST /s.json': () => respond(201, fixtures.created),
  })
  const app = await renderApp(request)
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Session' }))
  await waitFor(() => expect(app.getPathname()).toBe('/session-management/new'))
  expect(await screen.findByRole('button', { name: 'Add Liturgy' })).toBeOnTheScreen()
  // Opening the form wrote nothing, and the catalog loads only when the sheet opens.
  expect(request.mock.calls.some(([path]) => String(path).includes('liturgy_options'))).toBe(false)
  expect(request.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')).toHaveLength(0)
  await fireEvent.changeText(screen.getByLabelText('Service date'), '2030-10-04')
  await pick('Divine Liturgy')
  // The sheet filters locally by title, across every page of the catalog.
  await fireEvent.press(screen.getByRole('button', { name: 'Add Liturgy' }))
  expect(await screen.findByRole('button', { name: 'Add Evening Service' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Divine Liturgy is already selected' })).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText('Filter by title'), 'morn')
  expect(screen.queryByRole('button', { name: 'Add Evening Service' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Add Morning Service' }))
  expect(request.mock.calls.filter(([path]) => String(path).includes('liturgy_options'))).toHaveLength(2)
  await fireEvent.press(screen.getByRole('button', { name: 'Move Morning Service up' }))
  expect(screen.getByLabelText('Number 1 of 2: Morning Service')).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Gospel reading'), 'Հովհ. 1:1-17')
  expect(screen.getByText('Unsaved changes')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Create Session' }))
  await waitFor(() => expect(app.getPathname()).toBe('/services'))
  const post = request.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(JSON.parse(String(post[1]!.body))).toEqual({ client_request_id: '00000000-0000-4000-8000-00000000c0de',
    session: { date: '2030-10-04', liturgy_ids: [202, 101], options: { gospel: 'Հովհ. 1:1-17', epistle: '', before_message: '', after_message: '' } } })
  const notice = await screen.findByTestId('mutation-notice')
  expect(within(notice).getByText('Session created')).toBeOnTheScreen()
  expect(await screen.findByText('Service 4008')).toBeOnTheScreen()
  await fireEvent.press(within(notice).getByRole('button', { name: 'Open controls for Divine Liturgy · Morning Service' }))
  await waitFor(() => expect(app.getPathname()).toBe('/services/4008'))
})

it('confirms before creating a session dated today, and Cancel sends nothing', async () => {
  const today = todayIn('America/Los_Angeles', '2026-09-27')
  const request = fakeApi({
    [LIST]: () => respond(200, listed([])),
    'GET /s/new.json': () => respond(200, { ...fixtures.bootstrap, defaults: { date: today, options: {} } }),
    [CATALOG]: () => respond(200, fixtures.liturgyPage1),
    [CATALOG_2]: () => respond(200, fixtures.liturgyPage2),
    'POST /s.json': () => respond(201, fixtures.created),
  })
  await renderApp(request, '/session-management/new')
  await pick('Divine Liturgy')
  await fireEvent.press(screen.getByRole('button', { name: 'Create Session' }))
  expect(await screen.findByText('Create a session for today?')).toBeOnTheScreen()
  await fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!)
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

it('explains an incompatible backend without offering a write', async () => {
  const request = fakeApi({ 'GET /s/new.json': () => respond(404, {}), [CATALOG]: () => respond(404, {}) })
  await renderApp(request, '/session-management/new')
  expect(await screen.findByText(/does not offer session management/)).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Create Session' })).toBeNull()
})

it('keeps input and shows field errors after a 422', async () => {
  const request = fakeApi({
    'GET /s/new.json': () => respond(200, fixtures.bootstrap),
    [CATALOG]: () => respond(200, fixtures.liturgyPage1),
    [CATALOG_2]: () => respond(200, fixtures.liturgyPage2),
    'POST /s.json': () => respond(422, fixtures.validation),
  })
  await renderApp(request, '/session-management/new')
  await fireEvent.changeText(await screen.findByLabelText('Service date'), '2030-10-04')
  await pick('Morning Service')
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Create Session' })) })
  expect(await screen.findByText('Morning Service is no longer available.')).toBeOnTheScreen()
  expect(screen.getByText('is too long (maximum is 500 characters)')).toBeOnTheScreen()
  expect(screen.getByLabelText('Number 1 of 1: Morning Service')).toBeOnTheScreen()
  expect(screen.getByLabelText('Service date').props.value).toBe('2030-10-04')
})
