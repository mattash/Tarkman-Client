import { describe, expect, it, jest } from '@jest/globals'
import * as SecureStore from 'expo-secure-store'
import { AUTH_KEY, loadAuth, saveAuth } from '../features/auth/session'
import { authStore } from '../features/auth/storage'
import { safeReturnTo } from '../features/auth/returnTo'
import { formatServiceDate, normalizeMyServices, statusLabel } from '../features/services/api'
import { memoryStore, storedAuth, user } from './auth-helpers'

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

describe('stored sign-in', () => {
  it('round-trips through storage', async () => {
    const { store } = memoryStore()
    await saveAuth(store, { token: 'jwt', user })
    await expect(loadAuth(store)).resolves.toEqual({ token: 'jwt', user })
  })
  it('removes corrupt or incomplete records instead of trusting them', async () => {
    for (const raw of ['{not json', JSON.stringify({ token: '', user }), JSON.stringify({ token: 'jwt', user: { email: 'x@y.test' } })]) {
      const { store, saved } = memoryStore({ [AUTH_KEY]: raw })
      await expect(loadAuth(store)).resolves.toBeNull()
      expect(saved()).toBeNull()
    }
    await expect(loadAuth(memoryStore({ [AUTH_KEY]: storedAuth() }).store)).resolves.toMatchObject({ token: 'stored-token' })
  })
  it('keeps native tokens in this device keychain, readable only while unlocked', async () => {
    await authStore.set(AUTH_KEY, 'value')
    await authStore.get(AUTH_KEY)
    await authStore.remove(AUTH_KEY)
    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_KEY, 'value', options)
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(AUTH_KEY, options)
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_KEY, options)
  })
})

it('returns only to in-app paths other than sign-in', () => {
  expect(safeReturnTo('/services')).toBe('/services')
  expect(safeReturnTo(['/services', '/other'])).toBe('/services')
  for (const unsafe of [undefined, '', 'services', '//evil.example', 'https://evil.example', '/\\evil', '/sign-in', '/sign-in?returnTo=/x', '/a b']) {
    expect(safeReturnTo(unsafe)).toBe('/services')
  }
})

describe('my services', () => {
  it('normalizes the signed-in list, including the empty-list error body', () => {
    expect(normalizeMyServices({ sessions: [{ session: { id: 9, liturgy: 'Divine Liturgy', church_name: 'St. John', date: '2026-09-13', status: 'paused' } }] }))
      .toEqual([expect.objectContaining({ id: 9, title: 'Divine Liturgy', church: 'St. John', date: '2026-09-13', status: 'paused' })])
    expect(normalizeMyServices({ error: 'No sessions found' })).toEqual([])
    expect(() => normalizeMyServices({ error: 'Something else' })).toThrow('Unexpected services response.')
  })
  it('keeps every service in server-provided order without truncating at ten', () => {
    const sessions = Array.from({ length: 25 }, (_, index) => ({ session: { id: 25 - index } }))
    expect(normalizeMyServices({ sessions }).map(service => service.id)).toEqual(sessions.map(item => item.session.id))
    expect(() => normalizeMyServices({ sessions: [...sessions, { session: { id: 'malformed' } }] })).toThrow()
  })
  it('formats calendar dates without shifting the day and labels statuses', () => {
    expect(formatServiceDate('2026-09-13')).toMatch(/13/)
    expect(formatServiceDate('2026-09-13')).toMatch(/2026/)
    expect(formatServiceDate(null)).toBeNull()
    expect(formatServiceDate('soon')).toBeNull()
    expect(statusLabel('showing_gospel')).toBe('Showing gospel')
  })
})
