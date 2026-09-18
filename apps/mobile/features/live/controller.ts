import { benchmarkMark, benchmarkContext, beginRecovery, benchmarkCable, inheritRecovery, type BenchmarkContext } from '../observability/latencyBenchmark'
import type { SavedServiceInput } from '../offline/savedService'
import type { ReaderApi } from './api'
import type { CableClient } from './cable'
import { currentPart, parseEvent, sessionWithState, type SessionState, type LivePart, type LiveSession } from './contracts'
import { initialState, readerReducer, type ReaderAction } from './state'
import { t } from '../i18n'
const FULL_REFRESH_MS = 30000
type RecoveryMode = 'full' | 'navigation'
export interface Lifecycle {
  listen(callback: (active: boolean, online: boolean) => void): () => void
}
export interface ReaderCache {
  save(input: SavedServiceInput): void | Promise<void>
}
// One controller per mounted route/session. Cache writes never supply reader state. All async work
// is generation-scoped and abortable; event bursts schedule at most one rerun.
export function createReaderController(api: ReaderApi, cable: CableClient, cableUrl: string, lifecycle: Lifecycle, id: number | null, cache?: ReaderCache, loadExplanations = true) {
  let state = { ...initialState }, alive = false, active = true, online = true, epoch = 0, queued = false
  let manifestContext: string | null = null, stateSupported: boolean | null = null
  let observedRevision = 0
  let invalidations = 0, queuedFull = false, partsFetchedAt: number | null = null
  let request: AbortController | null = null, unsubscribe: (() => void) | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  let requestTimeout: ReturnType<typeof setTimeout> | null = null
  let explanationRequest: AbortController | null = null, explanationGeneration = 0
  let explanationTimeout: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  function dispatch(action: ReaderAction) { state = readerReducer(state, action); listeners.forEach(listener => listener()) }
  function cancelExplanations() {
    explanationGeneration++
    explanationRequest?.abort(); explanationRequest = null
    if (explanationTimeout) clearTimeout(explanationTimeout)
    explanationTimeout = null
  }
  function save(input: SavedServiceInput) {
    if (!cache || input.parts.length === 0) return
    try { void Promise.resolve(cache.save(input)).catch(() => {}) }
    catch { /* Losing saved text must never interrupt live reading. */ }
  }
  async function refreshExplanations(session: LiveSession, parts: LivePart[], generation: number, parent: AbortSignal) {
    const part = currentPart(session, parts)
    if (!loadExplanations || !part || !alive || epoch !== generation || queued) return
    const sequence = explanationGeneration, abort = new AbortController()
    inheritRecovery(abort.signal, parent)
    const isCurrent = () => alive && epoch === generation && sequence === explanationGeneration && !abort.signal.aborted && !state.stale
    explanationRequest = abort
    const timeout = setTimeout(() => {
      if (isCurrent()) dispatch({ type: 'explanations', explanations: [], failed: true })
      abort.abort()
    }, 12000)
    explanationTimeout = timeout
    try {
      const result = await api.explanations(session.id, abort.signal)
      if (!isCurrent()) return
      // Older servers can omit ownership. Verify those responses in the background;
      // a reading transition never waits for explanations or this compatibility check.
      if (result.some(explanation => explanation.liturgyPartId === null)) {
        const compact = session.revision != null && api.state ? await api.state(session.id, abort.signal) : null
        const unchanged = compact ? compact.id === session.id && compact.revision === session.revision && compact.contentContext === session.contentContext
          : JSON.stringify(session) === JSON.stringify(await api.session(session.id, abort.signal))
        if (!isCurrent()) return
        if (!unchanged) {
          dispatch({ type: 'stale' }); void recover('explanation_context', 'navigation'); return
        }
      }
      const explanations = result.filter(e => !e.liturgyPartId || e.liturgyPartId === part.liturgyPartId)
      dispatch({ type: 'explanations', explanations, failed: false })
      // A subscriber can dispose or start another recovery during dispatch.
      if (isCurrent()) save({ session, parts, explanations: { liturgyPartId: part.liturgyPartId, items: explanations } })
    } catch {
      if (isCurrent()) dispatch({ type: 'explanations', explanations: [], failed: true })
    } finally {
      clearTimeout(timeout)
      if (explanationTimeout === timeout) explanationTimeout = null
      if (explanationRequest === abort) explanationRequest = null
    }
  }
  function accept(session: LiveSession, parts: LivePart[], services: LiveSession[], generation: number, signal: AbortSignal, trace?: BenchmarkContext) {
    const part = currentPart(session, parts)
    benchmarkMark('recovery.accepted', { part_id: session.currentPartId, part_key: part?.key, position: session.currentPosition }, trace)
    dispatch({ type: 'recovered', now: Date.now(), explanationsLoading: loadExplanations && !!part,
      snapshot: { services, session, parts, explanations: [], explanationError: false, listed: services.some(s => s.id === id) } })
    if (alive && epoch === generation && !queued) {
      save({ session, parts, explanations: undefined })
      void refreshExplanations(session, parts, generation, signal)
    }
  }
  async function recoverRevisioned(abort: AbortController, generation: number, mode: RecoveryMode, trace?: BenchmarkContext): Promise<boolean> {
    if (id === null || !api.state || (stateSupported === false && mode !== 'full')) return false
    const beforeVersion = invalidations
    const before = await api.state(id, abort.signal)
    if (!before) { stateSupported = false; manifestContext = null; return false }
    stateSupported = true
    if (before.id !== id) throw new Error(t('errors.unexpectedSession'))
    if (!alive || epoch !== generation || abort.signal.aborted) return true
    const base = state.session
    const initial = base === null
    let parts = state.parts
    const knownCursor = before.cursor === null || (base && currentPart(sessionWithState(base, before, parts), parts))
    const fetchMetadata = initial || mode === 'full' || manifestContext !== before.contentContext
    const fetchParts = initial || manifestContext !== before.contentContext || !knownCursor
    const [metadata, services, loaded] = await Promise.all([
      fetchMetadata ? api.session(id, abort.signal) : Promise.resolve(base),
      initial || mode === 'full' ? api.services(abort.signal) : Promise.resolve(state.services),
      fetchParts ? api.parts(id, abort.signal) : Promise.resolve(parts),
    ])
    parts = loaded
    // Metadata and the manifest have no token of their own. Bracket their fetches
    // with state reads; cursor movement is safe, but content must remain unchanged.
    const verifyContent = fetchParts || fetchMetadata
    const verifying = verifyContent ? invalidations : beforeVersion
    const after = verifyContent ? await api.state(id, abort.signal) : before
    if (!alive || epoch !== generation || abort.signal.aborted) return true
    if (!metadata || metadata.id !== id || !after || after.id !== id) throw new Error(t('errors.unexpectedSession'))
    if (before.contentContext !== after.contentContext || verifying !== invalidations) {
      queued = true; queuedFull ||= before.contentContext !== after.contentContext
      dispatch({ type: 'stale' }); return true
    }
    // A replica/protocol error must not regress the accepted state or create an unbounded retry loop.
    if (after.revision < observedRevision || (base?.revision != null && after.revision < base.revision)) throw new Error(t('errors.unexpectedSession'))
    const session = sessionWithState(metadata, after, parts)
    if (after.cursor !== null && !currentPart(session, parts)) throw new Error(t('errors.unexpectedParts'))
    manifestContext = after.contentContext
    if (fetchParts) partsFetchedAt = Date.now()
    queued = false; queuedFull = false
    accept(session, parts, services, generation, abort.signal, trace)
    return true
  }
  /** Returns true for applied or already accepted publications. Never guess through a gap. */
  function applyPublication(update: SessionState): boolean {
    if (!alive || !active || !online || update.id !== id) return false
    observedRevision = Math.max(observedRevision, update.revision)
    const base = state.session
    if (!base || base.revision == null || state.stale || request) return false
    if (update.revision < base.revision) return true
    if (update.contentContext !== manifestContext) return false
    if (update.revision === base.revision) return true
    if (update.revision !== base.revision + 1) return false
    const session = sessionWithState(base, update, state.parts)
    if (update.cursor !== null && !currentPart(session, state.parts)) return false
    cancelExplanations()
    const signal = new AbortController().signal, trace = beginRecovery(id, signal, 'publication')
    accept(session, state.parts, state.services, epoch, signal, trace)
    benchmarkMark('recovery.end', {}, trace)
    return true
  }
  async function recover(reason = 'retry', mode: RecoveryMode = 'full') {
    if (!alive || !active || !online) return
    cancelExplanations()
    if (request) {
      invalidations++; queued = true; queuedFull ||= mode === 'full'
      benchmarkMark('recovery.queued', { reason }, benchmarkContext(id)); return
    }
    const generation = epoch, abort = new AbortController()
    const trace = beginRecovery(id, abort.signal, reason)
    request = abort; dispatch({ type: 'refresh' })
    const timeout = setTimeout(() => abort.abort(), 12000)
    requestTimeout = timeout
    try {
      if (api.state && await recoverRevisioned(abort, generation, mode, trace)) return
      if (!alive || epoch !== generation || abort.signal.aborted) return
      const age = partsFetchedAt === null ? Infinity : Date.now() - partsFetchedAt
      const reuse = mode === 'navigation' && state.session?.partsContext != null && state.parts.length > 0 && age >= 0 && age < FULL_REFRESH_MS
      const servicesPromise = reuse ? Promise.resolve(state.services) : api.services(abort.signal)
      if (id === null) {
        const services = await servicesPromise
        if (alive && epoch === generation) dispatch({ type: 'recovered', now: Date.now(), snapshot: { services, session: null, parts: [], explanations: [], explanationError: false, listed: true } })
      } else {
        let fetchedParts = !reuse
        const [services, session, loadedParts] = await Promise.all([
          servicesPromise, api.session(id, abort.signal), reuse ? Promise.resolve(state.parts) : api.parts(id, abort.signal),
        ])
        if (!alive || epoch !== generation) return
        let parts = loadedParts
        if (reuse && (session.partsContext !== state.session?.partsContext || !currentPart(session, parts))) {
          parts = await api.parts(id, abort.signal)
          fetchedParts = true
        }
        // Rails has no atomic snapshot endpoint or event sequence number. Read
        // canonical session again to detect transitions during the parallel GETs.
        // This read also covers navigation notifications/command acknowledgements that arrived BEFORE it.
        // A later notification or a full invalidation still requires another recovery.
        const verifying = invalidations, mustRerun = queuedFull
        const after = await api.session(id, abort.signal)
        if (!alive || epoch !== generation || abort.signal.aborted || mustRerun || verifying !== invalidations) { benchmarkMark('recovery.discarded', { reason: queued ? 'queued' : 'generation' }, trace); return }
        if (session.id !== id || after.id !== id) throw new Error(t('errors.unexpectedSession'))
        if (JSON.stringify(session) !== JSON.stringify(after)) { benchmarkMark('recovery.discarded', { reason: 'changed_snapshot' }, trace); queued = true; dispatch({ type: 'stale' }); return }
        const part = currentPart(after, parts)
        queued = false; queuedFull = false
        if (fetchedParts) partsFetchedAt = Date.now()
        benchmarkMark('recovery.accepted', { part_id: after.currentPartId, part_key: part?.key, position: after.currentPosition }, trace)
        dispatch({ type: 'recovered', now: Date.now(), explanationsLoading: loadExplanations && !!part,
          snapshot: { services, session: after, parts, explanations: [], explanationError: false, listed: services.some(s => s.id === id) } })
        if (alive && epoch === generation && !queued) {
          save({ session: after, parts, explanations: undefined })
          void refreshExplanations(after, parts, generation, abort.signal)
        }
      }
    } catch {
      benchmarkMark('recovery.failed', { aborted: abort.signal.aborted }, trace)
      if (alive && epoch === generation) dispatch({ type: 'failure', message: t('errors.refreshService') })
    } finally {
      benchmarkMark('recovery.end', {}, trace)
      clearTimeout(timeout)
      if (requestTimeout === timeout) requestTimeout = null
      if (request === abort) request = null
      if (alive && epoch === generation && queued) {
        const nextMode = queuedFull || mode === 'full' ? 'full' : 'navigation'
        queued = false; queuedFull = false; void recover('queued', nextMode)
      }
    }
  }
  function stopResources() {
    cancelExplanations()
    epoch++; queued = false; queuedFull = false; partsFetchedAt = null; request?.abort(); request = null
    if (requestTimeout) clearTimeout(requestTimeout)
    requestTimeout = null
    unsubscribe?.(); unsubscribe = null
    if (polling) clearInterval(polling)
    polling = null
  }
  function startResources() {
    if (!alive || !active || !online || polling) return
    polling = setInterval(() => { void recover('poll') }, FULL_REFRESH_MS)
    if (id !== null) unsubscribe = cable.subscribe(cableUrl, id, {
      connected: () => { dispatch({ type: 'connection', connected: true }); benchmarkMark('cable.connected', {}, benchmarkContext(id)); void recover('connected', stateSupported ? 'navigation' : 'full') },
      disconnected: () => { dispatch({ type: 'connection', connected: false }); benchmarkMark('cable.disconnected', {}, benchmarkContext(id)); void recover('disconnected', stateSupported ? 'navigation' : 'full') },
      received: value => {
        const event = parseEvent(value)
        if (event?.sessionId === id) {
          benchmarkCable(value, id)
          if (event.state && applyPublication(event.state)) return
          if (event.event === 'explanation_updated' && stateSupported && state.session && !request && !state.stale) {
            cancelExplanations()
            void refreshExplanations(state.session, state.parts, epoch, new AbortController().signal)
            return
          }
          dispatch({ type: 'stale' })
          void recover('cable', stateSupported || event.event === 'part_change' ? 'navigation' : 'full')
        }
      },
    })
    void recover('start')
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch,
    retry: () => {
      if (id !== null && !state.connected) { stopResources(); startResources() }
      else void recover()
    },
    refreshAfterCommand: (update?: SessionState | void) => {
      if (update && applyPublication(update)) return
      if (id !== null && !state.connected) { stopResources(); startResources() }
      else { dispatch({ type: 'stale' }); void recover('command', 'navigation') }
    },
    start() {
      if (alive) return () => {}
      alive = true
      const unlisten = lifecycle.listen((nextActive, nextOnline) => {
        if (!alive || (active === nextActive && online === nextOnline)) return
        active = nextActive; online = nextOnline
        stopResources(); dispatch({ type: 'connection', connected: false }); dispatch({ type: 'stale' })
        if (!online) dispatch({ type: 'failure', message: t('errors.noNetwork') })
        startResources()
      })
      startResources()
      return () => { alive = false; stopResources(); unlisten() }
    },
  }
}
