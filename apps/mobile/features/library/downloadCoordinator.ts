import { LibraryError, parseBundle, type Bundle, type CatalogItem, type FailureCode } from './contracts'
import type { LibraryApi } from './api'
import type { LibraryRepository, SavedItem } from './repository'
export interface LibraryState {
  ready: boolean; items: SavedItem[]; catalog: CatalogItem[]; recommended: CatalogItem[]; dismissed: boolean
  corrupt: number; loading: boolean; next: number | null; checkedAt: number | null; error?: FailureCode
  storageError?: 'storage'
  status: Record<number, 'downloading' | 'updating' | 'failed' | 'cancelled'>
  failures: Record<number, FailureCode>; revoked: number[]
}
interface Job { id: number; save: boolean; readers: number; durableClaimants: number; completion: Promise<Bundle | undefined>; controller: AbortController; run(): Promise<void>; done(): void }
/** One environment per controller. Disposal permanently invalidates all its work. */
export function createLibrary(environment: string, api: LibraryApi | null, store: LibraryRepository, now = Date.now) {
  let state: LibraryState = { ready: false, items: [], catalog: [], recommended: [], dismissed: false, corrupt: 0,
    loading: false, next: null, checkedAt: null, status: {}, failures: {}, revoked: [] }
  const listeners = new Set<() => void>(), jobs = new Map<number, Job>(), queue: Job[] = []
  let cancellation = 0
  let active = 0, disposed = false, hydration: Promise<void> | undefined, metadata: Promise<void> | undefined
  let catalogController: AbortController | undefined, catalogGeneration = 0
  let notBefore = 0, paused = false
  // Every operation shares this gate, including manual work and corrective rerequests.
  // A second 429 stops automatic recovery until an explicit action resumes it.
  async function gated<T>(signal: AbortSignal, retry: { used: boolean }, work: () => Promise<T>): Promise<T> {
    for (;;) {
      if (signal.aborted || disposed) throw new LibraryError('cancelled')
      if (paused) throw new LibraryError('rate-limited')
      const delay = notBefore - now()
      if (delay > 0) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new LibraryError('cancelled')) }
          // Long server delays remain honored; platform timers cannot exceed signed int32.
          const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, Math.min(delay, 2147483647))
          signal.addEventListener('abort', abort)
          if (signal.aborted) abort()
        })
        continue
      }
      try {
        const result = await work()
        if (signal.aborted || disposed) throw new LibraryError('cancelled')
        if (state.error === 'rate-limited' && !paused && now() >= notBefore) emit({ error: undefined })
        return result
      } catch (error) {
        if (signal.aborted || disposed) throw new LibraryError('cancelled')
        if (!(error instanceof LibraryError) || error.code !== 'rate-limited') throw error
        notBefore = Math.max(notBefore, now() + (error.retryAfterMs ?? 60000) + 1 + Math.floor(Math.random() * 1000))
        emit({ error: 'rate-limited' })
        if (retry.used) { paused = true; throw error }
        retry.used = true
      }
    }
  }
  const generations = new Map<number, number>()
  // Only recovery of the failed local operation clears its warning.
  const localFailures = new Set<'hydrate' | 'dismiss' | `remove:${number | 'all'}`>()
  const emit = (patch: Partial<LibraryState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(l => l()) } }
  const localFailure = (operation: Parameters<typeof localFailures.add>[0], failed: boolean) => {
    if (failed) localFailures.add(operation)
    else localFailures.delete(operation)
    return localFailures.size ? 'storage' as const : undefined
  }
  const epoch = (id: number) => generations.get(id) ?? 0
  const invalidate = (id: number) => { generations.set(id, epoch(id) + 1); jobs.get(id)?.controller.abort() }
  const item = (id: number) => state.items.find(i => i.id === id)
  function hydrate() {
    if (!hydration) hydration = store.hydrate(environment).then(result => emit({ ...result, ready: true, storageError: localFailure('hydrate', false) }), () => { hydration = undefined; emit({ ready: true, storageError: localFailure('hydrate', true) }) })
    return hydration
  }
  function pump() {
    while (!disposed && active < 2 && queue.length) {
      const job = queue.shift()!; active++
      void job.run().finally(() => { active--; if (jobs.get(job.id) === job) jobs.delete(job.id); job.done(); pump() })
    }
  }
  async function remove(id?: number, revoked = false) {
    await hydrate()
    const ids = id === undefined ? new Set([...state.items.map(i => i.id), ...jobs.keys()]) : new Set([id])
    ids.forEach(invalidate)
    if (revoked && id !== undefined) emit({ revoked: [...new Set([...state.revoked, id])] })
    try {
      await store.remove(environment, id)
      const status = { ...state.status }, failures = { ...state.failures }
      ids.forEach(i => { delete status[i]; delete failures[i] })
      if (id === undefined) for (const operation of localFailures) { if (operation.startsWith('remove:')) localFailures.delete(operation) }
      emit({ items: state.items.filter(i => !ids.has(i.id)), status, failures, storageError: localFailure(`remove:${id ?? 'all'}`, false), ...(id === undefined ? { corrupt: 0 } : {}) })
    } catch { emit({ storageError: localFailure(`remove:${id ?? 'all'}`, true) }); throw new LibraryError('storage') }
  }
  function cancelRefresh() {
    catalogGeneration++
    catalogController?.abort()
    catalogController = undefined
    metadata = undefined
    emit({ loading: false })
  }
  async function refresh(force = false, more = false) {
    const started = cancellation, generation = catalogGeneration
    await hydrate()
    if (started !== cancellation || generation !== catalogGeneration) return
    if (!api || disposed) { emit({ error: 'unsupported' }); return }
    if (metadata) return metadata
    if (force || more) paused = false
    if (paused) { emit({ error: 'rate-limited' }); return }
    // An outstanding error is never cached: the next ordinary check retries and clears it.
    if (!force && !more && state.error === undefined && state.checkedAt !== null && now() - state.checkedAt < 300000) return
    const controller = new AbortController(); catalogController = controller
    emit({ loading: true, error: now() < notBefore ? 'rate-limited' : undefined })
    metadata = (async () => {
      try {
        const after = more ? state.next ?? 0 : 0
        const retry = { used: false }
        const page = await gated(controller.signal, retry, () => api.catalog(controller.signal, after))
        let recommended = state.recommended
        if (!more && page.next_after_id === null) {
          recommended = page.liturgies.filter(item => item.recommended_rank !== null)
        } else if (!more) {
          recommended = []; let cursor = 0
          for (let pages = 0; pages < 100; pages++) {
            const rec = await gated(controller.signal, retry, () => api.catalog(controller.signal, cursor, true))
            if (rec.liturgies.some(item => item.recommended_rank === null)) throw new LibraryError('invalid')
            recommended.push(...rec.liturgies)
            if (rec.next_after_id === null) break
            cursor = rec.next_after_id
            if (pages === 99) throw new LibraryError('capacity')
          }
        }
        if (controller.signal.aborted || disposed || catalogController !== controller) return
        const catalog = more ? [...state.catalog, ...page.liturgies] : page.liturgies
        if (catalog.length > 10000) throw new LibraryError('capacity')
        emit({ catalog: [...new Map(catalog.map(i => [i.id, i])).values()], recommended: [...recommended].sort((a, b) => a.recommended_rank! - b.recommended_rank!), next: page.next_after_id,
          checkedAt: now(), loading: false })
      } catch (error) {
        // A check stopped by cancel() (e.g. backgrounding) failed nothing the reader asked for.
        if (!disposed && catalogController === controller) emit({ loading: false, error: controller.signal.aborted ? undefined : error instanceof LibraryError ? error.code : 'network' })
      } finally { if (catalogController === controller) { metadata = undefined; catalogController = undefined } }
    })()
    return metadata
  }
  function onlineResult(job: Job, signal?: AbortSignal): Promise<Bundle | undefined> {
    job.readers++
    return new Promise(resolve => {
      let settled = false
      const finish = (bundle?: Bundle, abandoned = false) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', abort)
        job.readers--
        // An explicit save waiting behind an online read owns its continued work.
        if (abandoned && !job.save && !job.readers && !job.durableClaimants) job.controller.abort()
        resolve(bundle)
      }
      const abort = () => finish(undefined, true)
      signal?.addEventListener('abort', abort)
      if (signal?.aborted) abort()
      void job.completion.then(bundle => finish(bundle))
    })
  }
  async function request(id: number, save: boolean, signal?: AbortSignal): Promise<Bundle | undefined> {
    const started = cancellation, requestedGeneration = epoch(id)
    await hydrate()
    if (started !== cancellation || requestedGeneration !== epoch(id)) throw new LibraryError('cancelled')
    if (!save && signal?.aborted) return
    if (disposed || !api || (save && !store.durable)) throw new LibraryError('unsupported')
    const existing = jobs.get(id)
    if (existing) {
      if (existing.controller.signal.aborted) {
        // Focus can return before the abandoned job's finally has run.
        await existing.completion
        if (disposed || started !== cancellation || requestedGeneration !== epoch(id) || (!save && signal?.aborted)) return
        return request(id, save, signal)
      }
      if (!save) return onlineResult(existing, signal)
      if (existing.save) return existing.completion
      // Online work cannot satisfy durable intent. Keep it alive for an explicit
      // claimant, then queue a normal saved request with its own intent/commit.
      existing.durableClaimants++
      try { await existing.completion } finally { existing.durableClaimants-- }
      if (disposed || existing.controller.signal.aborted || started !== cancellation || requestedGeneration !== epoch(id)) return
      return request(id, true)
    }
    if (queue.length >= 100) { emit({ error: 'capacity' }); throw new LibraryError('capacity') }
    paused = false // A new explicit read/download/update can resume a stopped operation.
    const retry = { used: false }
    const generation = epoch(id), controller = new AbortController()
    const valid = () => !disposed && !controller.signal.aborted && epoch(id) === generation
    let result: Bundle | undefined
    let resolveCompletion!: (bundle: Bundle | undefined) => void
    const completion = new Promise<Bundle | undefined>(resolve => { resolveCompletion = resolve })
    let job!: Job
    const promise = new Promise<void>(done => {
      job = { id, save, readers: 0, durableClaimants: 0, completion, controller, done: () => { done(); resolveCompletion(result) }, run: async () => {
        try {
          if (!valid()) throw new LibraryError('cancelled')
          if (save) {
            await store.intent(environment, id)
            if (!valid()) throw new LibraryError('cancelled')
            if (!item(id)) emit({ items: [...state.items, { id, bundle: null, savedAt: null, verifiedAt: null }] })
          }
          const old = item(id)?.bundle
          let bundle = await gated(controller.signal, retry, () => api.bundle(id, controller.signal, old?.revision))
          if (!valid()) throw new LibraryError('cancelled')
          if (bundle === null) {
            // A 304 is useful only for the intact revision actually held on disk now.
            const intact = await store.intact(environment, id)
            if (!valid()) throw new LibraryError('cancelled')
            if (old && intact?.revision === old.revision) {
              if (save) { await store.verify(environment, id, now()); if (!valid()) throw new LibraryError('cancelled'); emit({ items: state.items.map(i => i.id === id ? { ...i, verifiedAt: now() } : i) }) }
              result = old; return
            }
            bundle = await gated(controller.signal, retry, () => api.bundle(id, controller.signal))
            if (bundle === null) throw new LibraryError('invalid')
          }
          bundle = parseBundle(bundle, id)
          const expected = state.catalog.find(i => i.id === id)?.revision
          if (expected && bundle.revision !== expected) {
            // One unconditional per-item revalidation handles a catalog/download snapshot race.
            const checked = await gated(controller.signal, retry, () => api.bundle(id, controller.signal))
            if (!checked || checked.revision !== bundle.revision) throw new LibraryError('invalid')
            bundle = parseBundle(checked, id)
          }
          if (!valid()) throw new LibraryError('cancelled')
          if (save && old?.revision === bundle.revision) {
            const intact = await store.intact(environment, id)
            if (!valid()) throw new LibraryError('cancelled')
            if (intact?.revision === old.revision) {
              await store.verify(environment, id, now())
              if (!valid()) throw new LibraryError('cancelled')
              emit({ items: state.items.map(i => i.id === id ? { ...i, verifiedAt: now() } : i) })
              result = old; return
            }
          }
          if (save) {
            const timestamp = now()
            await store.commit(environment, bundle, timestamp, valid)
            if (!valid()) throw new LibraryError('cancelled')
            emit({ items: [...state.items.filter(i => i.id !== id), { id, bundle, savedAt: timestamp, verifiedAt: timestamp }] })
          }
          result = bundle
          emit({ revoked: state.revoked.filter(i => i !== id) })
        } catch (error) {
          const code = error instanceof LibraryError ? error.code : 'network'
          if (valid() && code === 'unavailable') {
            try { await remove(id, true) } catch {
              // remove() invalidated this job before its delete failed, so the emit below is skipped:
              // settle the kept copy here or it stays busy until restart. The storage error is visible.
              emit({ status: { ...state.status, [id]: 'failed' }, failures: { ...state.failures, [id]: code } })
            }
          }
          if (!disposed && epoch(id) === generation) emit({ status: { ...state.status, [id]: code === 'cancelled' ? 'cancelled' : 'failed' }, failures: { ...state.failures, [id]: code } })
        } finally {
          if (valid()) {
            const status = { ...state.status }; if (status[id] !== 'failed') delete status[id]
            emit({ status })
          }
        }
      } }
      jobs.set(id, job); queue.push(job)
      emit({ status: { ...state.status, [id]: item(id)?.bundle ? 'updating' : 'downloading' }, failures: { ...state.failures, [id]: undefined } as LibraryState['failures'] })
      pump()
    })
    if (!save) return onlineResult(job, signal)
    await promise
    return result
  }
  function cancel() {
    cancellation++
    cancelRefresh()
    for (const [id, job] of jobs) {
      job.controller.abort()
      emit({ status: { ...state.status, [id]: 'cancelled' } })
    }
  }
  return {
    environment, durable: store.durable, enabled: !!api,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    hydrate, refresh, cancelRefresh, remove, request,
    async sync() { const started = cancellation; await hydrate(); if (started === cancellation) await Promise.all(state.items.map(i => request(i.id, true))) },
    async dismiss() { try { await store.dismiss(environment); emit({ dismissed: true, storageError: localFailure('dismiss', false) }) } catch { emit({ storageError: localFailure('dismiss', true) }) } },
    cancel,
    dispose() { cancel(); disposed = true; for (const job of queue.splice(0)) job.done(); listeners.clear() },
  }
}
export type LibraryController = ReturnType<typeof createLibrary>
