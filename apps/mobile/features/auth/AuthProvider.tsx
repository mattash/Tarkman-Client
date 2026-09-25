import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { KeyValueAdapter, LoginCredentials, User } from '@tarkman/core'
import { createAuthApi } from './api'
import { clearAuth, loadAuth, saveAuth } from './session'
import { authStore } from './storage'
import { t } from '../i18n'

export type AuthState =
  | { status: 'hydrating' }
  | { status: 'signedOut'; expired?: boolean }
  | { status: 'signedIn'; token: string; user: User }

export type AuthorizedInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }

export interface AuthContextValue {
  state: AuthState
  signIn(credentials: LoginCredentials): Promise<void>
  signOut(): void
  /** Sends an API request with the current token. A 401 ends that sign-in and rejects with an unauthorized error. */
  authorizedFetch(path: string, init?: AuthorizedInit): Promise<Response>
  beforeSignOut(callback: () => void): () => void
}

export interface AuthProviderProps {
  apiBase?: string
  store?: KeyValueAdapter
  request?: typeof fetch
  children: ReactNode
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ apiBase, store = authStore, request = fetch, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'hydrating' })
  const latest = useRef<AuthState>(state)
  // Tokens may be reissued verbatim. A request belongs to a sign-in, not to its token string.
  const signInGeneration = useRef(0)
  const endListeners = useRef(new Set<() => void>())
  const beforeSignOut = useCallback((callback: () => void) => {
    endListeners.current.add(callback)
    return () => { endListeners.current.delete(callback) }
  }, [])
  // Storage writes run one at a time, so a late clear can never erase a newer sign-in.
  const writes = useRef<Promise<void>>(Promise.resolve())
  const api = useMemo(() => apiBase ? createAuthApi(apiBase, request) : null, [apiBase, request])

  const commit = useCallback((next: AuthState) => {
    if (next.status === 'signedIn') signInGeneration.current++
    latest.current = next; setState(next)
  }, [])
  const persist = useCallback((write: () => Promise<void>) => {
    writes.current = writes.current.then(write).catch(() => { /* The in-memory session stays authoritative when storage fails. */ })
    return writes.current
  }, [])

  useEffect(() => {
    let active = true
    loadAuth(store).catch(() => null).then(auth => {
      if (active && latest.current.status === 'hydrating') commit(auth ? { status: 'signedIn', ...auth } : { status: 'signedOut' })
    })
    return () => { active = false }
  }, [store, commit])

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    if (!api) throw new Error(t('signIn.notConfigured'))
    const auth = await api.signIn(credentials)
    await persist(() => saveAuth(store, auth))
    if (latest.current.status === 'signedIn') endListeners.current.forEach(callback => callback())
    commit({ status: 'signedIn', ...auth })
  }, [api, store, persist, commit])

  const signOut = useCallback(() => {
    const previous = latest.current
    if (previous.status === 'signedIn') endListeners.current.forEach(callback => callback())
    commit({ status: 'signedOut' })
    void persist(() => clearAuth(store))
    if (previous.status === 'signedIn') api?.signOut(previous.token).catch(() => { /* Revocation is best effort; the token is already gone from this device. */ })
  }, [api, store, persist, commit])

  const authorizedFetch = useCallback(async (path: string, init: AuthorizedInit = {}) => {
    const session = latest.current
    if (session.status !== 'signedIn' || !apiBase) throw unauthorizedError()
    const generation = signInGeneration.current
    const response = await request(`${apiBase}${path}`, { ...init, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', ...init.headers, Authorization: `Bearer ${session.token}` } })
    if (response.status !== 401) return response
    // Only the sign-in that sent this request ends; a concurrent 401 or a newer sign-in is left alone.
    const current = latest.current
    if (current.status === 'signedIn' && signInGeneration.current === generation && current === session) {
      endListeners.current.forEach(callback => callback())
      commit({ status: 'signedOut', expired: true })
      void persist(() => clearAuth(store))
    }
    throw unauthorizedError()
  }, [apiBase, request, store, persist, commit])

  const value = useMemo(() => ({ state, signIn, signOut, authorizedFetch, beforeSignOut }), [state, signIn, signOut, authorizedFetch, beforeSignOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

const UNAUTHORIZED = 'UnauthorizedError'
function unauthorizedError(): Error {
  return Object.assign(new Error(t('signIn.expired')), { name: UNAUTHORIZED })
}
export function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.name === UNAUTHORIZED
}
