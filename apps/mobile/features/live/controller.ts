import { benchmarkMark, benchmarkContext, beginRecovery, benchmarkCable } from '../observability/latencyBenchmark'
import type { SavedServiceInput } from '../offline/savedService'
import type { ReaderApi } from './api'
import type { CableClient } from './cable'
import { currentPart, parseEvent } from './contracts'
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
export function createReaderController(api: ReaderApi, cable: CableClient, cableUrl: string, lifecycle: Lifecycle, id: number | null, cache?: ReaderCache) {
  let state = { ...initialState }, alive = false, active = true, online = true, epoch = 0, queued = false
  let invalidations = 0, queuedFull = false, partsFetchedAt: number | null = null
  let request: AbortController | null = null, unsubscribe: (() => void) | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  let requestTimeout: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  function dispatch(action: ReaderAction) { state = readerReducer(state, action); listeners.forEach(listener => listener()) }
  async function recover(reason = 'retry', mode: RecoveryMode = 'full') {
    if (!alive || !active || !online) return
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
      const age = partsFetchedAt === null ? Infinity : Date.now() - partsFetchedAt
      const reuse = mode === 'navigation' && state.session?.partsContext != null && state.parts.length > 0 && age >= 0 && age < FULL_REFRESH_MS
      const servicesPromise = reuse ? Promise.resolve(state.services) : api.services(abort.signal)
      if (id === null) {
        const services = await servicesPromise
        if (alive && epoch === generation) dispatch({ type: 'recovered', now: Date.now(), snapshot: { services, session: null, parts: [], explanations: [], explanationError: false, listed: true } })
      } else {
        let fetchedParts = !reuse
        const [services, session, loadedParts, initialExplanations] = await Promise.all([
          servicesPromise, api.session(id, abort.signal), reuse ? Promise.resolve(state.parts) : api.parts(id, abort.signal),
          api.explanations(id, abort.signal).then(explanations => ({ explanations, failed: false }), () => ({ explanations: [], failed: true })),
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
        // An earlier explanation request may have run before the covered notification. Refresh it after that
        // notification as well; anything arriving during this refresh or the session check still invalidates both.
        const explanationResult = queued && !mustRerun
          ? await api.explanations(id, abort.signal).then(explanations => ({ explanations, failed: false }), () => ({ explanations: [], failed: true }))
          : initialExplanations
        const after = await api.session(id, abort.signal)
        if (!alive || epoch !== generation || mustRerun || verifying !== invalidations) { benchmarkMark('recovery.discarded', { reason: queued ? 'queued' : 'generation' }, trace); return }
        if (session.id !== id || after.id !== id) throw new Error(t('errors.unexpectedSession'))
        if (JSON.stringify(session) !== JSON.stringify(after)) { benchmarkMark('recovery.discarded', { reason: 'changed_snapshot' }, trace); queued = true; dispatch({ type: 'stale' }); return }
        const part = currentPart(after, parts)
        const explanations = explanationResult.explanations.filter(e => !e.liturgyPartId || e.liturgyPartId === part?.liturgyPartId)
        queued = false; queuedFull = false
        if (fetchedParts) partsFetchedAt = Date.now()
        benchmarkMark('recovery.accepted', { part_id: after.currentPartId, part_key: part?.key, position: after.currentPosition }, trace)
        dispatch({ type: 'recovered', now: Date.now(), snapshot: { services, session: after, parts, explanations,
          explanationError: explanationResult.failed, listed: services.some(s => s.id === id) } })
        if (cache && parts.length > 0 && alive && epoch === generation && !queued) {
          // Subscribers may dispose this generation during dispatch. Storage must
          // never delay recovery or turn a successful live read into a failure.
          try {
            void Promise.resolve(cache.save({ session: after, parts,
              explanations: explanationResult.failed ? undefined : { liturgyPartId: part?.liturgyPartId ?? null, items: explanations },
            })).catch(() => {})
          } catch { /* Losing saved text must never interrupt live reading. */ }
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
      connected: () => { dispatch({ type: 'connection', connected: true }); benchmarkMark('cable.connected', {}, benchmarkContext(id)); void recover('connected') },
      disconnected: () => { dispatch({ type: 'connection', connected: false }); benchmarkMark('cable.disconnected', {}, benchmarkContext(id)); void recover('disconnected') },
      received: value => {
        const event = parseEvent(value)
        if (event?.sessionId === id) {
          benchmarkCable(value, id); dispatch({ type: 'stale' })
          void recover('cable', event.event === 'part_change' ? 'navigation' : 'full')
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
    refreshAfterCommand: () => {
      if (id !== null && !state.connected) { stopResources(); startResources() }
      else void recover('command', 'navigation')
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
