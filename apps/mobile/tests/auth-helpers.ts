import { jest } from '@jest/globals'
import type { KeyValueAdapter } from '@tarkman/core'
import { AUTH_KEY } from '../features/auth/session'

export const API = 'https://api.test'
export const user = { id: 3, email: 'deacon@example.test', name: 'Deacon Hovhannes', roles: ['editor'] }
export const storedAuth = (token = 'stored-token') => JSON.stringify({ token, user })

export function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const store = {
    get: jest.fn(async (key: string) => data.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => { data.set(key, value) }),
    remove: jest.fn(async (key: string) => { data.delete(key) }),
  } satisfies KeyValueAdapter
  return { store, saved: () => data.get(AUTH_KEY) ?? null }
}

export function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: (name: string) => headers[name] ?? null } } as unknown as Response
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(settle => { resolve = settle })
  return { promise, resolve }
}

/** A fetch stand-in keyed by "METHOD /path"; unexpected requests fail the test. */
export function fakeApi(handlers: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  return jest.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace(API, '')}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(init ?? {})
  })
}
