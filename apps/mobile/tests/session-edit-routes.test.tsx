import { expect, it, jest } from '@jest/globals'
import { Slot } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import SignedInLayout from '../app/(signed-in)/_layout'
import MyServicesScreen from '../app/(signed-in)/services'
import EditSessionScreen from '../app/(signed-in)/session-management/[id]/edit'
import { ThemeProvider } from '../design/ThemeProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AUTH_KEY } from '../features/auth/session'
import { clearMutations } from '../features/services/management/mutations'
import { API, fakeApi, memoryStore, respond, storedAuth } from './auth-helpers'
import * as fixtures from './fixtures/session-management'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-00000000c0de') }))

const LIST = 'GET /s.json?pagination=cursor&limit=20'
const listed = (ids: number[]) => ({ sessions: ids.map(id => ({ session: { id, liturgy: `Service ${id}`, date: '2030-10-04' } })), page: { limit: 20, has_more: false, next_cursor: null } })
const emptyOk = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('empty') }, headers: { get: () => null } } as unknown as Response)

async function renderApp(request: typeof fetch, initialUrl = '/services') {
  clearMutations()
  const { store } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const app = renderRouter({
    _layout: () => <ThemeProvider scheme="light"><AuthProvider apiBase={API} store={store} request={request}><Slot /></AuthProvider></ThemeProvider>,
    '(signed-in)/_layout': SignedInLayout,
    '(signed-in)/services': MyServicesScreen,
    '(signed-in)/session-management/[id]/edit': EditSessionScreen,
  }, { initialUrl })
  await app
  return { getPathname: app.getPathname }
}

it('offers labelled Edit and Delete per row, beside Open controls', async () => {
  await renderApp(fakeApi({ [LIST]: () => respond(200, listed([4008])) }))
  expect(await screen.findByRole('button', { name: 'Open controls for Service 4008' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Edit Service 4008, Fri, Oct 4, 2030' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Delete Service 4008, Fri, Oct 4, 2030' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Add Session' })).toBeOnTheScreen()
})

it('edits from the row, saves only the change, and returns to a refreshed My Sessions', async () => {
  const request = fakeApi({
    [LIST]: () => respond(200, listed([4008])),
    'GET /s/4008/edit.json': () => respond(200, { schema_version: 1, session: fixtures.managedSession() }),
    'GET /s/liturgy_options.json?limit=50': () => respond(200, fixtures.liturgyPage1),
    'PATCH /s/4008.json': () => respond(200, { session: fixtures.managedSession({ revision: 18, options: { gospel: 'Luke 2:1-20', epistle: '', before_message: 'Welcome.', after_message: '' } }) }),
  })
  const app = await renderApp(request)
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit Service 4008, Fri, Oct 4, 2030' }))
  await waitFor(() => expect(app.getPathname()).toBe('/session-management/4008/edit'))
  const gospel = await screen.findByLabelText('Gospel reading')
  expect(gospel.props.value).toBe('John 1:1-17')
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await fireEvent.changeText(gospel, 'Luke 2:1-20')
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(app.getPathname()).toBe('/services'))
  const patch = request.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(JSON.parse(String(patch[1]!.body))).toEqual({ expected_revision: 17, session: { options: { gospel: 'Luke 2:1-20' } } })
  expect(within(await screen.findByTestId('mutation-notice')).getByText('Session saved')).toBeOnTheScreen()
})

it('deletes only after a confirmation naming the session, and the row does not come back', async () => {
  let deleted = false
  const request = fakeApi({
    [LIST]: () => respond(200, listed(deleted ? [12] : [4008, 12])),
    'GET /s/4008/edit.json': () => respond(200, { schema_version: 1, session: fixtures.managedSession() }),
    'DELETE /s/4008.json': () => { deleted = true; return emptyOk() },
  })
  await renderApp(request)
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Service 4008, Fri, Oct 4, 2030' }))
  expect(await screen.findByText('Divine Liturgy · Morning Service · Sun, Oct 4, 2026')).toBeOnTheScreen()
  expect(request.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
  await fireEvent.press(screen.getByRole('button', { name: /^Delete Session Divine Liturgy · Morning Service, Sun, Oct 4, 2026, permanently$/ }))
  expect(within(await screen.findByTestId('mutation-notice')).getByText('Session deleted')).toBeOnTheScreen()
  await waitFor(() => expect(screen.queryByText('Service 4008')).toBeNull())
  expect(screen.getByText('Service 12')).toBeOnTheScreen()
  expect(JSON.parse(String(request.mock.calls.find(([, init]) => init?.method === 'DELETE')![1]!.body))).toEqual({ expected_revision: 17 })
})

it('rejects an invalid editor link without loading anything', async () => {
  const request = fakeApi({})
  await renderApp(request, '/session-management/abc/edit')
  expect(await screen.findByText('That service link is not valid.')).toBeOnTheScreen()
  expect(request).not.toHaveBeenCalled()
})
