import { randomUUID } from 'expo-crypto'
import type { AuthContextValue } from '../../auth/AuthProvider'
import { putPresence, type PresenceSnapshot } from './api'

export type PresenceState = { kind: 'checking' | 'unavailable' | 'fresh'; snapshot?: PresenceSnapshot;
  reason?: 'ineligible' | 'unauthorized' | 'denied' | 'unsupported' | 'missing-session' | 'ambiguous' | 'transient' }
interface Identity { uuid: string; sequences: Map<number, number> }
const identities = new WeakMap<object, Map<string, Identity>>()
export function identityFor(signIn: object, environment: string): Identity {
  let environments = identities.get(signIn)
  if (!environments) { environments = new Map(); identities.set(signIn, environments) }
  let identity = environments.get(environment)
  if (!identity) { identity = { uuid: randomUUID(), sequences: new Map() }; environments.set(environment, identity) }
  return identity
}
function next(identity: Identity, sessionId: number): number {
  const sequence = (identity.sequences.get(sessionId) ?? 0) + 1
  if (!Number.isSafeInteger(sequence)) throw new Error('Presence sequence exhausted') // i18n-ignore: internal protocol error, never shown to readers
  identity.sequences.set(sessionId, sequence)
  return sequence
}

/** One serial loop; generations fence all asynchronous completions before the next activation. */
export class PresenceCoordinator {
  private generation = 0
  private active = false
  private timer?: ReturnType<typeof setTimeout>
  private stale?: ReturnType<typeof setTimeout>
  private abort?: AbortController
  private failures = 0
  private terminal: PresenceState['reason'] | null = null
  private interval = 10
  private state: PresenceState = { kind: 'unavailable', reason: 'ineligible' }
  constructor(private readonly fetcher: AuthContextValue['authorizedFetch'], private readonly sessionId: number,
    private readonly identity: Identity, private readonly notify: (state: PresenceState) => void,
    private readonly clock = () => performance.now()) {}
  private publish(state: PresenceState) { this.state = state; this.notify(state) }
  start() {
    if (this.active || this.terminal) return
    this.active = true
    const generation = ++this.generation
    this.failures = 0
    this.publish({ kind: 'checking' })
    void this.sample(generation)
  }
  stop() {
    if (!this.active) return
    this.active = false
    ++this.generation
    clearTimeout(this.timer); clearTimeout(this.stale)
    this.abort?.abort()
    this.publish({ kind: 'unavailable', reason: this.terminal ?? 'ineligible' })
    if (this.terminal) return // Forbidden/missing/unsupported endpoint: do not probe it with a leave.
    // Allocate now, before a new activation can issue its heartbeat. Never retry this leave.
    const sequence = next(this.identity, this.sessionId)
    void putPresence(this.fetcher, this.sessionId, this.identity.uuid, sequence, false, AbortSignal.timeout(12000)).catch(() => {})
  }
  private async sample(generation: number) {
    if (!this.active || generation !== this.generation) return
    const sequence = next(this.identity, this.sessionId)
    const abort = new AbortController()
    this.abort = abort
    const timeout = setTimeout(() => abort.abort(), 12000)
    const started = this.clock()
    try {
      const snapshot = await putPresence(this.fetcher, this.sessionId, this.identity.uuid, sequence, true, abort.signal)
      if (!this.active || generation !== this.generation) return
      if (snapshot.acceptedSequence !== sequence || !snapshot.selfPresent) throw new Error('Presence update not accepted') // i18n-ignore: internal protocol error, never shown to readers
      this.interval = snapshot.interval
      this.failures = 0
      this.publish({ kind: 'fresh', snapshot })
      clearTimeout(this.stale)
      this.stale = setTimeout(() => { if (generation === this.generation) this.publish({ kind: 'unavailable' }) }, snapshot.interval * 2000)
      this.timer = setTimeout(() => { void this.sample(generation) }, snapshot.interval * 1000)
    } catch (error) {
      if (!this.active || generation !== this.generation) return
      clearTimeout(this.stale)
      const status = (error as { status?: number }).status
      const reason: PresenceState['reason'] = status === 401 ? 'unauthorized' : status === 403 ? 'denied' :
        status === 404 ? 'ambiguous' : status === 405 ? 'unsupported' : 'transient'
      if (status === 403 || status === 404 || status === 405) this.terminal = reason
      // Invalidate any prior accepted count before the optional 404 diagnostic read.
      this.publish({ kind: 'unavailable', reason })
      if (status === 404) {
        // One bounded authenticated read distinguishes a missing session from an older backend.
        // A failed/ambiguous read does not turn absence into zero or keep probing with PUTs.
        let diagnostic: PresenceState['reason'] = 'ambiguous'
        try {
          const read = await this.fetcher(`/s/${this.sessionId}.json`, { signal: AbortSignal.timeout(12000) })
          diagnostic = read.ok ? 'unsupported' : read.status === 404 ? 'missing-session' : 'ambiguous'
        } catch { /* Expiry remains authoritative in authorizedFetch; no credential fallback. */ }
        if (this.active && generation === this.generation && this.terminal) {
          this.terminal = diagnostic
          this.publish({ kind: 'unavailable', reason: diagnostic })
        }
        return
      }
      if (status === 401 || status === 403 || status === 405) return
      this.failures++
      this.timer = setTimeout(() => { void this.sample(generation) }, Math.min(30000, 2000 * 2 ** Math.min(this.failures - 1, 4)))
    } finally {
      clearTimeout(timeout)
      if (this.abort === abort) this.abort = undefined
      // A response arrived after its local freshness window; do not call it fresh.
      if (generation === this.generation && this.state.kind === 'fresh' && this.clock() - started >= this.interval * 2000) this.publish({ kind: 'unavailable' })
    }
  }
}
