import type { AuthResponse, KeyValueAdapter } from '@tarkman/core'
import { positiveId, record } from '../live/contracts'

export const AUTH_KEY = 'tarkman.auth.v1'

/** Keeps only the fields the app uses, so extra user attributes from the API are never stored. */
export function normalizeAuth(value: unknown): AuthResponse | null {
  const data = record(value), user = record(data.user)
  const id = positiveId(user.id)
  if (typeof data.token !== 'string' || !data.token || id === null || typeof user.email !== 'string' || !user.email) return null
  return { token: data.token, user: { id, email: user.email, name: typeof user.name === 'string' ? user.name : '',
    roles: Array.isArray(user.roles) ? user.roles.filter((role): role is string => typeof role === 'string') : [] } }
}

export async function loadAuth(store: KeyValueAdapter): Promise<AuthResponse | null> {
  const raw = await store.get(AUTH_KEY)
  if (!raw) return null
  try {
    const auth = normalizeAuth(JSON.parse(raw))
    if (auth) return auth
  } catch { /* A corrupt record is removed below. */ }
  await store.remove(AUTH_KEY)
  return null
}

export function saveAuth(store: KeyValueAdapter, auth: AuthResponse): Promise<void> {
  return store.set(AUTH_KEY, JSON.stringify(auth))
}

export function clearAuth(store: KeyValueAdapter): Promise<void> {
  return store.remove(AUTH_KEY)
}
