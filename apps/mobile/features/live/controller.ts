import type { SavedServiceInput } from '../offline/savedService'
import type { ReaderApi } from './api'
import type { CableClient } from './cable'
import { currentPart, parseEvent } from './contracts'
import { initialState, readerReducer, type ReaderAction } from './state'
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
  let request: AbortController | null = null, unsubscribe: (() => void) | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  let requestTimeout: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  function dispatch(action: ReaderAction) { state = readerReducer(state, action); listeners.forEach(listener => listener()) }
  async function recover() {
    if (!alive || !active || !online) return
    if (request) { queued = true; return }
    const generation = epoch, abort = new AbortController()
    request = abort; dispatch({ type: 'refresh' })
    const timeout = setTimeout(() => abort.abort(), 12000)
    requestTimeout = timeout
    try {
      const servicesPromise = api.services(abort.signal)
      if (id === null) {
        const services = await servicesPromise
        if (alive && epoch === generation) dispatch({ type: 'recovered', now: Date.now(), snapshot: { services, session: null, parts: [], explanations: [], explanationError: false, listed: true } })
      } else {
        const [services, session, parts, explanationResult] = await Promise.all([
          servicesPromise, api.session(id, abort.signal), api.parts(id, abort.signal),
          api.explanations(id, abort.signal).then(explanations => ({ explanations, failed: false }), () => ({ explanations: [], failed: true })),
        ])
        // Rails has no atomic snapshot endpoint or event sequence number. Read
        // canonical session again to detect transitions during the parallel GETs.
        const after = await api.session(id, abort.signal)
        if (!alive || epoch !== generation || queued) return
        if (session.id !== id || after.id !== id) throw new Error('Unexpected session response.')
        if (JSON.stringify(session) !== JSON.stringify(after)) { queued = true; dispatch({ type: 'stale' }); return }
        const part = currentPart(after, parts)
        const explanations = explanationResult.explanations.filter(e => !e.liturgyPartId || e.liturgyPartId === part?.liturgyPartId)
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
      if (alive && epoch === generation) dispatch({ type: 'failure', message: 'Could not refresh the service. Check your connection and retry.' })
    } finally {
      clearTimeout(timeout)
      if (requestTimeout === timeout) requestTimeout = null
      if (request === abort) request = null
      if (alive && epoch === generation && queued) { queued = false; void recover() }
    }
  }
  function stopResources() {
    epoch++; queued = false; request?.abort(); request = null
    if (requestTimeout) clearTimeout(requestTimeout)
    requestTimeout = null
    unsubscribe?.(); unsubscribe = null
    if (polling) clearInterval(polling)
    polling = null
  }
  function startResources() {
    if (!alive || !active || !online || polling) return
    polling = setInterval(() => { void recover() }, 30000)
    if (id !== null) unsubscribe = cable.subscribe(cableUrl, id, {
      connected: () => { dispatch({ type: 'connection', connected: true }); void recover() },
      disconnected: () => { dispatch({ type: 'connection', connected: false }); void recover() },
      received: value => { if (parseEvent(value)?.sessionId === id) { dispatch({ type: 'stale' }); void recover() } },
    })
    void recover()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch,
    retry: () => {
      if (id !== null && !state.connected) { stopResources(); startResources() }
      else void recover()
    },
    start() {
      if (alive) return () => {}
      alive = true
      const unlisten = lifecycle.listen((nextActive, nextOnline) => {
        if (!alive || (active === nextActive && online === nextOnline)) return
        active = nextActive; online = nextOnline
        stopResources(); dispatch({ type: 'connection', connected: false }); dispatch({ type: 'stale' })
        if (!online) dispatch({ type: 'failure', message: 'No network connection. Reading will refresh when you reconnect.' })
        startResources()
      })
      startResources()
      return () => { alive = false; stopResources(); unlisten() }
    },
  }
}
