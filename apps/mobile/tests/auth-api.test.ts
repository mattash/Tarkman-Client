import { expect, it } from '@jest/globals'
import { createAuthApi } from '../features/auth/api'
import { API, fakeApi, respond, user } from './auth-helpers'

it('signs in with JSON credentials, without cookies, and keeps only the user fields the app uses', async () => {
  const request = fakeApi({ 'POST /users/sign_in': () => respond(200, { token: 'jwt', user: { ...user, encrypted_password: 'x', confirmation_token: 'secret' } }) })
  await expect(createAuthApi(API, request).signIn({ email: 'deacon@example.test', password: 'pw' })).resolves.toEqual({ token: 'jwt', user })
  const init = request.mock.calls[0][1]!
  expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
  expect(JSON.parse(String(init.body))).toEqual({ user: { email: 'deacon@example.test', password: 'pw' } })
})

it('reads the token from the Authorization header when the body omits it', async () => {
  const request = fakeApi({ 'POST /users/sign_in': () => respond(200, { user }, { Authorization: 'Bearer header-jwt' }) })
  await expect(createAuthApi(API, request).signIn({ email: 'a@b.test', password: 'pw' })).resolves.toMatchObject({ token: 'header-jwt' })
})

it('explains failed sign-ins without exposing unexpected server output', async () => {
  const signIn = (response: Response) => createAuthApi(API, fakeApi({ 'POST /users/sign_in': () => response })).signIn({ email: 'a@b.test', password: 'pw' })
  await expect(signIn(respond(401, { error: 'You have to confirm your email address before continuing.' }))).rejects.toThrow('You have to confirm your email address')
  await expect(signIn(respond(401, {}))).rejects.toThrow('Email or password is incorrect.')
  await expect(signIn(respond(500, { error: 'PG::ConnectionBad' }))).rejects.toThrow('Could not sign in. Please try again.')
  await expect(signIn(respond(200, { user }))).rejects.toThrow('Could not sign in. Please try again.')
})

it('reports connection failures separately from rejected credentials', async () => {
  const request = fakeApi({ 'POST /users/sign_in': () => { throw new TypeError('Network request failed') } })
  await expect(createAuthApi(API, request).signIn({ email: 'a@b.test', password: 'pw' })).rejects.toThrow('Could not reach Tarkman')
})

it('revokes the bearer token on sign-out and treats an already-ended token as signed out', async () => {
  const request = fakeApi({ 'DELETE /users/sign_out': () => respond(204) })
  await createAuthApi(API, request).signOut('jwt')
  expect(request.mock.calls[0][1]).toMatchObject({ method: 'DELETE', credentials: 'omit', headers: { Authorization: 'Bearer jwt' } })
  await expect(createAuthApi(API, fakeApi({ 'DELETE /users/sign_out': () => respond(401) })).signOut('jwt')).resolves.toBeUndefined()
  await expect(createAuthApi(API, fakeApi({ 'DELETE /users/sign_out': () => respond(500) })).signOut('jwt')).rejects.toThrow('Could not revoke')
})
