import { expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider, isUnauthorized, useAuth } from '../features/auth/AuthProvider'
import { AUTH_KEY } from '../features/auth/session'
import { API, deferred, fakeApi, memoryStore, respond, storedAuth, user } from './auth-helpers'

function setup(store: ReturnType<typeof memoryStore>['store'], request: typeof fetch) {
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider apiBase={API} store={store} request={request}>{children}</AuthProvider>
  return renderHook(() => useAuth(), { wrapper })
}

it('reports nothing until stored sign-in has loaded, then restores it after a restart', async () => {
  const load = deferred<string | null>()
  const { store } = memoryStore()
  store.get.mockImplementationOnce(() => load.promise)
  const { result } = await setup(store, fakeApi({}))
  expect(result.current.state).toEqual({ status: 'hydrating' })
  await act(async () => load.resolve(storedAuth()))
  expect(result.current.state).toEqual({ status: 'signedIn', token: 'stored-token', user })
})

it('starts signed out when nothing usable is stored', async () => {
  const { store, saved } = memoryStore({ [AUTH_KEY]: '{corrupt' })
  const { result } = await setup(store, fakeApi({}))
  await waitFor(() => expect(result.current.state).toEqual({ status: 'signedOut' }))
  expect(saved()).toBeNull()
})

it('signs in, stores the session, and sends the bearer token without cookies', async () => {
  const { store, saved } = memoryStore()
  const request = fakeApi({ 'POST /users/sign_in': () => respond(200, { token: 'jwt', user }), 'GET /s.json': () => respond(200, { sessions: [] }) })
  const { result } = await setup(store, request)
  await waitFor(() => expect(result.current.state.status).toBe('signedOut'))
  await act(() => result.current.signIn({ email: user.email, password: 'pw' }))
  expect(result.current.state).toEqual({ status: 'signedIn', token: 'jwt', user })
  expect(JSON.parse(saved()!)).toEqual({ token: 'jwt', user })
  await result.current.authorizedFetch('/s.json')
  expect(request.mock.calls[1][1]).toMatchObject({ credentials: 'omit', headers: { Accept: 'application/json', Authorization: 'Bearer jwt' } })
})

it('keeps the session usable for now when the keychain rejects the write', async () => {
  const { store } = memoryStore()
  store.set.mockRejectedValueOnce(new Error('keychain unavailable'))
  const { result } = await setup(store, fakeApi({ 'POST /users/sign_in': () => respond(200, { token: 'jwt', user }) }))
  await waitFor(() => expect(result.current.state.status).toBe('signedOut'))
  await act(() => result.current.signIn({ email: user.email, password: 'pw' }))
  expect(result.current.state).toMatchObject({ status: 'signedIn', token: 'jwt' })
})

it('signing out clears this device and revokes the token on the server', async () => {
  const { store, saved } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const request = fakeApi({ 'DELETE /users/sign_out': () => respond(204) })
  const { result } = await setup(store, request)
  await waitFor(() => expect(result.current.state.status).toBe('signedIn'))
  await act(async () => result.current.signOut())
  expect(result.current.state).toEqual({ status: 'signedOut' })
  await waitFor(() => expect(saved()).toBeNull())
  expect(request).toHaveBeenCalledWith(`${API}/users/sign_out`, expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer stored-token' }) }))
})

it('ends the sign-in once when concurrent requests are rejected', async () => {
  const { store, saved } = memoryStore({ [AUTH_KEY]: storedAuth() })
  const { result } = await setup(store, fakeApi({ 'GET /a.json': () => respond(401), 'GET /b.json': () => respond(401) }))
  await waitFor(() => expect(result.current.state.status).toBe('signedIn'))
  let outcomes: PromiseSettledResult<Response>[] = []
  await act(async () => { outcomes = await Promise.allSettled([result.current.authorizedFetch('/a.json'), result.current.authorizedFetch('/b.json')]) })
  expect(outcomes.every(outcome => outcome.status === 'rejected' && isUnauthorized(outcome.reason))).toBe(true)
  expect(result.current.state).toEqual({ status: 'signedOut', expired: true })
  await waitFor(() => expect(saved()).toBeNull())
  expect(store.remove).toHaveBeenCalledTimes(1)
})

it('does not let a late 401 for an earlier sign-in end a newer one', async () => {
  const slow = deferred<Response>()
  const { store, saved } = memoryStore({ [AUTH_KEY]: storedAuth('old-token') })
  const request = fakeApi({ 'GET /s.json': () => slow.promise, 'DELETE /users/sign_out': () => respond(204), 'POST /users/sign_in': () => respond(200, { token: 'new-token', user }) })
  const { result } = await setup(store, request)
  await waitFor(() => expect(result.current.state.status).toBe('signedIn'))
  const pending = result.current.authorizedFetch('/s.json')
  await act(async () => { result.current.signOut(); await result.current.signIn({ email: user.email, password: 'pw' }) })
  await act(async () => { slow.resolve(respond(401)); await expect(pending).rejects.toThrow('Your sign-in has ended') })
  expect(result.current.state).toMatchObject({ status: 'signedIn', token: 'new-token' })
  expect(JSON.parse(saved()!)).toMatchObject({ token: 'new-token' })
})
