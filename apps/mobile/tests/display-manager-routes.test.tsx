import { expect, it, jest } from '@jest/globals'
import { Slot } from 'expo-router'
import { renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import SignedInLayout from '../app/(signed-in)/_layout'
import SignInScreen from '../app/sign-in'
import DisplayLinksRoute from '../app/(signed-in)/display-links'
import { API, deferred, fakeApi, memoryStore, respond, storedAuth } from './auth-helpers'
import { link } from './fixtures/displayLink'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('../features/live/config', () => ({ readerConfig: () => ({ endpoints: { api: 'https://api.test', cable: 'wss://api.test/cable' } }) }))
async function renderApp(store: ReturnType<typeof memoryStore>['store'], request: typeof fetch) {
  const app = renderRouter({
    _layout: () => <ThemeProvider><AuthProvider apiBase={API} store={store} request={request}><Slot /></AuthProvider></ThemeProvider>,
    index: () => <Text>Home</Text>,
    'sign-in': SignInScreen,
    '(signed-in)/_layout': SignedInLayout,
    '(signed-in)/display-links': DisplayLinksRoute,
  }, { initialUrl: '/display-links' })
  await app
  return { getPathname: app.getPathname, getSearchParams: app.getSearchParams }
}
it('protects the direct manager URL and preserves its return path', async () => {
  const request = fakeApi({})
  const app = await renderApp(memoryStore().store, request)
  await waitFor(() => expect(app.getPathname()).toBe('/sign-in'))
  expect(app.getSearchParams()).toMatchObject({ returnTo: '/display-links' })
  expect(request).not.toHaveBeenCalled()
})
it('waits for auth hydration before requesting only the signed-in mine collection', async () => {
  const pending = deferred<string | null>(), local = memoryStore()
  local.store.get.mockReturnValue(pending.promise)
  const request = fakeApi({ 'GET /display_links?scope=mine': () => respond(200, [link]) })
  const app = await renderApp(local.store, request)
  expect(request).not.toHaveBeenCalled()
  pending.resolve(storedAuth())
  await waitFor(() => expect(screen.getByText('Sanctuary')).toBeOnTheScreen())
  expect(app.getPathname()).toBe('/display-links')
  expect(request.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer stored-token' })
})
