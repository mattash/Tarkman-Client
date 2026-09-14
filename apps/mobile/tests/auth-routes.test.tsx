import { expect, it } from '@jest/globals'
import { Slot } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'
import SignInScreen from '../app/sign-in'
import SignedInLayout from '../app/(signed-in)/_layout'
import MyServicesScreen from '../app/(signed-in)/services'
import { ThemeProvider } from '../design/ThemeProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AUTH_KEY } from '../features/auth/session'
import { API, deferred, fakeApi, memoryStore, respond, storedAuth, user } from './auth-helpers'

const services = { sessions: [{ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', date: '2026-09-13', status: 'paused' } }] }

async function renderApp(store: ReturnType<typeof memoryStore>['store'], request: typeof fetch, initialUrl: string) {
  const app = renderRouter({
    _layout: () => <ThemeProvider scheme="light"><AuthProvider apiBase={API} store={store} request={request}><Slot /></AuthProvider></ThemeProvider>,
    index: () => <Text>Live services home</Text>,
    'sign-in': SignInScreen,
    '(signed-in)/_layout': SignedInLayout,
    '(signed-in)/services': MyServicesScreen,
  }, { initialUrl })
  await app
  return { getPathname: app.getPathname, getSearchParams: app.getSearchParams }
}

async function enterCredentials(password = 'pw') {
  await fireEvent.changeText(screen.getByLabelText('Email'), ` ${user.email} `)
  await fireEvent.changeText(screen.getByLabelText('Password'), password)
}

it('sends a signed-out link to a protected screen through sign-in and back', async () => {
  const { store, saved } = memoryStore()
  const request = fakeApi({ 'POST /users/sign_in': () => respond(200, { token: 'jwt', user }), 'GET /s.json?pagination=cursor&limit=20': () => respond(200, services) })
  const app = await renderApp(store, request, '/services')
  await waitFor(() => expect(app.getPathname()).toBe('/sign-in'))
  expect(app.getSearchParams()).toMatchObject({ returnTo: '/services' })
  await enterCredentials()
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(app.getPathname()).toBe('/services'))
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
  expect(screen.getByText('Paused')).toBeOnTheScreen()
  expect(screen.getByText(`Signed in as ${user.name}`)).toBeOnTheScreen()
  expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toEqual({ user: { email: user.email, password: 'pw' } })
  expect(JSON.parse(saved()!)).toMatchObject({ token: 'jwt' })
})

it('explains a rejected sign-in', async () => {
  const request = fakeApi({ 'POST /users/sign_in': () => respond(401, { error: 'Invalid Email or password.' }) })
  await renderApp(memoryStore().store, request, '/sign-in')
  await enterCredentials('wrong')
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
  expect(request).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Invalid Email or password.')).toBeOnTheScreen()
  expect(screen.getByLabelText('Password').props.value).toBe('')
})

it('asks for both fields before contacting the server', async () => {
  const request = fakeApi({})
  await renderApp(memoryStore().store, request, '/sign-in')
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByText('Enter your email and password.')).toBeOnTheScreen()
  expect(request).not.toHaveBeenCalled()
})

it('waits for stored sign-in before deciding whether a protected screen may render', async () => {
  const load = deferred<string | null>()
  const { store } = memoryStore()
  store.get.mockImplementationOnce(() => load.promise)
  const app = await renderApp(store, fakeApi({ 'GET /s.json?pagination=cursor&limit=20': () => respond(200, services) }), '/services')
  expect(screen.getByLabelText('Checking your sign-in')).toBeOnTheScreen()
  expect(app.getPathname()).toBe('/services')
  load.resolve(storedAuth())
  expect(await screen.findByText('Divine Liturgy')).toBeOnTheScreen()
  expect(app.getPathname()).toBe('/services')
})

it('returns to sign-in with a notice when the server rejects the stored token', async () => {
  const { store, saved } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const app = await renderApp(store, fakeApi({ 'GET /s.json?pagination=cursor&limit=20': () => respond(401) }), '/services')
  await waitFor(() => expect(app.getPathname()).toBe('/sign-in'))
  expect(screen.getByText('Your sign-in has ended. Sign in again to continue.')).toBeOnTheScreen()
  await waitFor(() => expect(saved()).toBeNull())
})

it('signing out from My services clears the device and revokes the token', async () => {
  const { store, saved } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const request = fakeApi({ 'GET /s.json?pagination=cursor&limit=20': () => respond(200, { error: 'No sessions found' }), 'DELETE /users/sign_out': () => respond(204) })
  const app = await renderApp(store, request, '/services')
  expect(await screen.findByText('No services yet')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(app.getPathname()).toBe('/sign-in'))
  await waitFor(() => expect(saved()).toBeNull())
  expect(request).toHaveBeenCalledWith(`${API}/users/sign_out`, expect.objectContaining({ method: 'DELETE' }))
})

it('keeps cards on load-more and refresh failure, with accessible retries and an end marker', async () => {
  let firstAttempts = 0
  let laterAttempts = 0
  const page = (id: number, next: string | null) => ({
    sessions: [{ session: { id, liturgy: `Service ${id}`, status: 'paused', date: '2026-09-13' } }],
    page: { limit: 20, has_more: next !== null, next_cursor: next },
  })
  const request = fakeApi({
    'GET /s.json?pagination=cursor&limit=20': () => {
      firstAttempts++
      return firstAttempts === 1 ? respond(200, page(9, 'next')) : firstAttempts === 2 ? respond(500) : respond(200, page(10, null))
    },
    'GET /s.json?pagination=cursor&limit=20&cursor=next': () => {
      laterAttempts++
      return laterAttempts === 1 ? respond(500) : respond(200, page(8, null))
    },
  })
  await renderApp(memoryStore({ [AUTH_KEY]: storedAuth() }).store, request, '/services')
  expect(await screen.findByRole('button', { name: 'Open controls for Service 9' })).toBeOnTheScreen()
  await fireEvent(screen.getByTestId('my-services-list'), 'endReached')
  const retry = await screen.findByRole('button', { name: 'Retry loading more services' })
  expect(screen.getByText('Service 9')).toBeOnTheScreen()
  await fireEvent.press(retry)
  expect(await screen.findByText('Service 8')).toBeOnTheScreen()
  expect(screen.getByText('All services loaded')).toBeOnTheScreen()
  await fireEvent(screen.getByTestId('my-services-list'), 'refresh')
  expect(await screen.findByRole('alert')).toBeOnTheScreen()
  expect(screen.getByText('Service 9')).toBeOnTheScreen()
  expect(screen.getByText('Service 8')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Service 10')).toBeOnTheScreen()
  expect(screen.queryByText('Service 9')).toBeNull()
  expect(screen.queryByText('Service 8')).toBeNull()
})
