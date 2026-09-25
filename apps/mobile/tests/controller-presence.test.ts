import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { identityFor, PresenceCoordinator, type PresenceState } from '../features/services/presence/coordinator'
import { parsePresence } from '../features/services/presence/api'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }))
const snapshot = (sequence = 1, count = 1) => ({ session_id: 91, reporting_scope: 'participating_clients', controller_count: count,
  other_controller_count: count - 1, self_present: true, accepted_sequence: sequence, server_time: '2026-09-25T12:00:00Z',
  self_expires_at: '2026-09-25T12:00:45Z', heartbeat_interval_seconds: 10, lease_ttl_seconds: 45 })
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

describe('presence contract', () => {
  it('rejects malformed and inconsistent responses', () => {
    expect(parsePresence(snapshot(), 91).others).toBe(0)
    for (const bad of [{ controller_count: null }, { other_controller_count: -1 }, { other_controller_count: 1 },
      { reporting_scope: 'all_clients' }, { accepted_sequence: null }, { self_expires_at: null },
      { heartbeat_interval_seconds: 0 }, { session_id: 92 }, { server_time: 'yesterday' }]) {
      expect(() => parsePresence({ ...snapshot(), ...bad }, 91)).toThrow()
    }
    expect(parsePresence({ ...snapshot(), self_present: false, self_expires_at: null, other_controller_count: 1 }, 91).selfPresent).toBe(false)
    expect(parsePresence({ ...snapshot(), self_expires_at: '2026-09-25T12:00:47Z' }, 91).selfPresent).toBe(true)
    expect(() => parsePresence({ ...snapshot(), self_expires_at: '2026-09-25T12:00:47.001Z' }, 91)).toThrow()
  })
})

describe('serial lifecycle', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })
  it('isolates runtimes and environments while retaining identity within a sign-in', () => {
    const signIn = {}
    expect(identityFor(signIn, 'one')).toBe(identityFor(signIn, 'one'))
    expect(identityFor(signIn, 'one')).not.toBe(identityFor({}, 'one'))
    expect(identityFor(signIn, 'one')).not.toBe(identityFor(signIn, 'two'))
  })
  it('orders heartbeat, leave and resume despite deferred responses; rejects duplicate 200', async () => {
    const calls: { body: { sequence: number; active: boolean }; resolve: (value: Response) => void }[] = []
    const fetcher = jest.fn((_path: string, init?: RequestInit) => new Promise<Response>(resolve => {
      calls.push({ body: JSON.parse(init!.body as string), resolve })
    }))
    const states: PresenceState[] = []
    const coordinator = new PresenceCoordinator(fetcher, 91, identityFor({}, 'api'), state => states.push(state))
    coordinator.start(); expect(calls[0].body).toEqual({ sequence: 1, active: true })
    coordinator.stop(); expect(calls[1].body).toEqual({ sequence: 2, active: false })
    coordinator.start(); expect(calls[2].body).toEqual({ sequence: 3, active: true })
    calls[0].resolve(response(snapshot(1))); await flush()
    expect(states.at(-1)?.kind).toBe('checking')
    calls[2].resolve(response(snapshot(3, 2))); await flush()
    expect(states.at(-1)?.snapshot?.others).toBe(1)
    await jest.advanceTimersByTimeAsync(10000)
    expect(calls[3].body.sequence).toBe(4)
    calls[3].resolve(response(snapshot(3))); await flush()
    expect(states.at(-1)?.kind).toBe('unavailable')
    coordinator.stop()
  })
  it('does not loop on capability failure, but recovers a 5xx after backoff', async () => {
    const replies = [response({}, 404), response({}, 404), response({}, 500), response(snapshot(3))]
    const fetcher = jest.fn(async () => replies.shift() ?? response(snapshot(4)))
    const states: PresenceState[] = []
    const identity = identityFor({}, 'api')
    const coordinator = new PresenceCoordinator(fetcher, 91, identity, state => states.push(state))
    coordinator.start(); await flush()
    await jest.advanceTimersByTimeAsync(60000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(states.at(-1)?.reason).toBe('missing-session')
    coordinator.stop(); coordinator.start(); await flush()
    expect(fetcher).toHaveBeenCalledTimes(2) // terminal latch survives stop/start
    const reentered = new PresenceCoordinator(fetcher, 91, identity, state => states.push(state))
    reentered.start(); await flush()
    expect(states.at(-1)?.kind).toBe('unavailable')
    await jest.advanceTimersByTimeAsync(2000)
    expect(states.at(-1)?.kind).toBe('fresh')
    reentered.stop()
  })
  it.each([
    [404, 200, 'unsupported'], [404, 404, 'missing-session'], [404, 503, 'ambiguous'],
    [405, null, 'unsupported'], [403, null, 'denied'],
  ])('retains diagnostic reason for PUT %i, bounded read %s', async (status, read, reason) => {
    const fetcher = jest.fn(async (path: string) => path.includes('controller_presence') ? response({}, status) : response({}, read ?? 500))
    const states: PresenceState[] = []
    const coordinator = new PresenceCoordinator(fetcher, 91, identityFor({}, String(status) + String(read)), state => states.push(state))
    coordinator.start(); await flush()
    expect(states.at(-1)).toMatchObject({ kind: 'unavailable', reason })
    expect(fetcher).toHaveBeenCalledTimes(status === 404 ? 2 : 1)
    await jest.advanceTimersByTimeAsync(60000)
    expect(fetcher).toHaveBeenCalledTimes(status === 404 ? 2 : 1)
    coordinator.stop()
    expect(fetcher).toHaveBeenCalledTimes(status === 404 ? 2 : 1)
    coordinator.start()
    expect(fetcher).toHaveBeenCalledTimes(status === 404 ? 2 : 1)
  })
  it('counts two independent clients using the exact same bearer token without touching commands or readers', async () => {
    const leases = new Map<string, { sequence: number; active: boolean }>()
    const token = 'same-test-token'
    const fetcher = jest.fn(async (path: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(token).toBe('same-test-token')
      const id = path.split('/').at(-1)!.replace('.json', '')
      const { sequence, active } = JSON.parse(init!.body as string) as { sequence: number; active: boolean }
      const prior = leases.get(id)
      if (!prior || sequence > prior.sequence) leases.set(id, { sequence, active })
      const count = [...leases.values()].filter(lease => lease.active).length
      const self = leases.get(id)!.active
      return response({ ...snapshot(leases.get(id)!.sequence, count), self_present: self,
        other_controller_count: count - Number(self), self_expires_at: self ? snapshot().self_expires_at : null })
    })
    const first = identityFor({}, 'same-api')
    const second = identityFor({}, 'same-api')
    // UUID mock is deterministic by default; independent tabs supply distinct cryptographic IDs in production.
    second.uuid = '00000000-0000-4000-8000-000000000002'
    const a: PresenceState[] = [], b: PresenceState[] = []
    const controllerA = new PresenceCoordinator(fetcher, 91, first, state => a.push(state))
    const controllerB = new PresenceCoordinator(fetcher, 91, second, state => b.push(state))
    controllerA.start(); await flush()
    controllerB.start(); await flush()
    await jest.advanceTimersByTimeAsync(10000)
    expect(a.at(-1)?.snapshot?.others).toBe(1)
    expect(b.at(-1)?.snapshot?.others).toBe(1)
    controllerB.stop(); await flush()
    await jest.advanceTimersByTimeAsync(10000)
    expect(a.at(-1)?.snapshot?.others).toBe(0)
    controllerA.stop()
  })
  it('expires a confirmed sample after two intervals while the next request hangs', async () => {
    let calls = 0
    const fetcher = jest.fn(async () => {
      calls++
      if (calls === 1) return response(snapshot())
      return new Promise<Response>(() => {})
    })
    const states: PresenceState[] = []
    const coordinator = new PresenceCoordinator(fetcher, 91, identityFor({}, 'stale'), state => states.push(state))
    coordinator.start(); await flush()
    expect(states.at(-1)?.kind).toBe('fresh')
    await jest.advanceTimersByTimeAsync(20000)
    expect(states.at(-1)?.kind).toBe('unavailable')
    expect(fetcher).toHaveBeenCalledTimes(2)
    coordinator.stop()
  })
  it('drops a fresh count before a deferred 404 diagnostic and fences its completion on exit', async () => {
    let resolveRead!: (response: Response) => void
    const read = new Promise<Response>(resolve => { resolveRead = resolve })
    const calls: string[] = []
    const fetcher = jest.fn(async (path: string, init?: RequestInit) => {
      calls.push(path)
      if (path === '/s/91.json') return read
      const body = JSON.parse(init!.body as string) as { sequence: number; active: boolean }
      return body.sequence === 1 ? response(snapshot(1, 2)) : response({}, 404)
    })
    const states: PresenceState[] = []
    const coordinator = new PresenceCoordinator(fetcher, 91, identityFor({}, 'deferred-diagnostic'), state => states.push(state))
    coordinator.start(); await flush()
    expect(states.at(-1)?.kind).toBe('fresh')
    await jest.advanceTimersByTimeAsync(10000)
    await flush()
    expect(states.at(-1)).toMatchObject({ kind: 'unavailable', reason: 'ambiguous' })
    expect(calls).toHaveLength(3) // initial PUT, failed heartbeat PUT, one diagnostic GET
    await jest.advanceTimersByTimeAsync(20000)
    expect(states.at(-1)?.kind).toBe('unavailable')
    resolveRead(response({}, 200)); await flush()
    expect(states.at(-1)).toMatchObject({ kind: 'unavailable', reason: 'unsupported' })
    coordinator.stop()
    expect(calls).toHaveLength(3) // no terminal leave

    let resolveOld!: (response: Response) => void
    const oldRead = new Promise<Response>(resolve => { resolveOld = resolve })
    const oldCalls: string[] = []
    const oldFetcher = jest.fn(async (path: string) => { oldCalls.push(path); return path === '/s/91.json' ? oldRead : response({}, 404) })
    const afterExit: PresenceState[] = []
    const old = new PresenceCoordinator(oldFetcher, 91, identityFor({}, 'exited-diagnostic'), state => afterExit.push(state))
    old.start(); await flush()
    expect(afterExit.at(-1)?.reason).toBe('ambiguous')
    old.stop()
    resolveOld(response({}, 404)); await flush()
    expect(afterExit.at(-1)).toMatchObject({ kind: 'unavailable', reason: 'ambiguous' })
    expect(oldCalls).toHaveLength(2)
  })
})
