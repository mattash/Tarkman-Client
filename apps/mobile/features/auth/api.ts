import type { AuthResponse, LoginCredentials } from '@tarkman/core'
import { record } from '../live/contracts'
import { normalizeAuth } from './session'
import { t } from '../i18n'

export interface AuthApi {
  signIn(credentials: LoginCredentials): Promise<AuthResponse>
  /** Revokes the token on the server (devise-jwt denylist). */
  signOut(token: string): Promise<void>
}

const TIMEOUT_MS = 15000

export function createAuthApi(base: string, request: typeof fetch = fetch): AuthApi {
  async function send(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      // Tokens travel only in the Authorization header; cookies are never sent or stored.
      return await request(`${base}${path}`, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' })
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    async signIn({ email, password }) {
      let response: Response
      try {
        response = await send('/users/sign_in', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ user: { email, password } }) })
      } catch {
        throw new Error(t('signIn.unreachable'))
      }
      const data = record(await response.json().catch(() => null))
      if (!response.ok) throw new Error(response.status === 401 ? serverMessage(data) ?? t('signIn.incorrect') : t('signIn.failed'))
      const header = response.headers.get('Authorization')
      const auth = normalizeAuth({ ...data, token: data.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined) })
      if (!auth) throw new Error(t('signIn.failed'))
      return auth
    },
    async signOut(token) {
      const response = await send('/users/sign_out', { method: 'DELETE', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
      // A 401 means the token is already expired or revoked.
      if (!response.ok && response.status !== 401) throw new Error(t('signIn.revokeFailed'))
    },
  }
}

/** Devise explains failed sign-ins (wrong password, unconfirmed email) in a short `error` string. */
function serverMessage(data: Record<string, unknown>): string | undefined {
  return typeof data.error === 'string' && data.error.length > 0 && data.error.length <= 200 ? data.error : undefined
}
