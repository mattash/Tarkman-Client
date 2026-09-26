import { LibraryError, parseBundle, type Bundle, type CatalogItem, type FailureCode } from './contracts'
import type { LibraryApi } from './api'
import type { LibraryRepository, SavedItem } from './repository'
export interface LibraryState {
  ready: boolean; items: SavedItem[]; catalog: CatalogItem[]; recommended: CatalogItem[]; dismissed: boolean
  corrupt: number; loading: boolean; next: number | null; checkedAt: number | null; error?: FailureCode
  status: Record<number, 'downloading' | 'updating' | 'failed' | 'cancelled'>
  failures: Record<number, FailureCode>; revoked: number[]
}
interface Job { id: number; completion: Promise<Bundle | undefined>; controller: AbortController; run(): Promise<void>; done(): void }
/** One environment per controller. Disposal permanently invalidates all its work. */
export function createLibrary(environment: string, api: LibraryApi | null, store: LibraryRepository, now = Date.now) {
  let state: LibraryState = { ready: false, items: [], catalog: [], recommended: [], dismissed: false, corrupt: 0,
    loading: false, next: null, checkedAt: null, status: {}, failures: {}, revoked: [] }
  const listeners = new Set<() => void>(), jobs = new Map<number, Job>(), queue: Job[] = []
  let cancellation = 0
  let active = 0, disposed = false, hydration: Promise<void> | undefined, metadata: Promise<void> | undefined
  let catalogController: AbortController | undefined
  const generations = new Map<number, number>()
  const emit = (patch: Partial<LibraryState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(l => l()) } }
  const epoch = (id: number) => generations.get(id) ?? 0
  const invalidate = (id: number) => { generations.set(id, epoch(id) + 1); jobs.get(id)?.controller.abort() }
  const item = (id: number) => state.items.find(i => i.id === id)
  function hydrate() {
    if (!hydration) hydration = store.hydrate(environment).then(result => emit({ ...result, ready: true }), () => { hydration = undefined; emit({ ready: true, error: 'storage' }) })
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
      emit({ items: state.items.filter(i => !ids.has(i.id)), status, failures, ...(id === undefined ? { corrupt: 0 } : {}) })
    } catch { emit({ error: 'storage' }); throw new LibraryError('storage') }
  }
  async function refresh(force = false, more = false) {
    const started = cancellation
    await hydrate()
    if (started !== cancellation) return
    if (!api || disposed) { emit({ error: 'unsupported' }); return }
    if (metadata) return metadata
    if (!force && !more && state.checkedAt !== null && now() - state.checkedAt < 300000) return
    const controller = new AbortController(); catalogController = controller
    emit({ loading: true, error: undefined })
    metadata = (async () => {
      try {
        const after = more ? state.next ?? 0 : 0
        const page = await api.catalog(controller.signal, after)
        let recommended = state.recommended
        if (!more) {
          recommended = []; let cursor = 0
          for (let pages = 0; pages < 100; pages++) {
            const rec = await api.catalog(controller.signal, cursor, true)
            if (rec.liturgies.some(item => item.recommended_rank === null)) throw new LibraryError('invalid')
            recommended.push(...rec.liturgies)
            if (rec.next_after_id === null) break
            cursor = rec.next_after_id
            if (pages === 99) throw new LibraryError('capacity')
          }
        }
        if (controller.signal.aborted || disposed) return
        const catalog = more ? [...state.catalog, ...page.liturgies] : page.liturgies
        if (catalog.length > 10000) throw new LibraryError('capacity')
        emit({ catalog: [...new Map(catalog.map(i => [i.id, i])).values()], recommended: recommended.sort((a, b) => a.recommended_rank! - b.recommended_rank!), next: page.next_after_id,
          checkedAt: now(), loading: false })
      } catch (error) {
        if (!disposed) emit({ loading: false, error: error instanceof LibraryError ? error.code : 'network' })
      } finally { metadata = undefined; catalogController = undefined }
    })()
    return metadata
  }
  async function request(id: number, save: boolean): Promise<Bundle | undefined> {
    const started = cancellation
    await hydrate()
    if (started !== cancellation) throw new LibraryError('cancelled')
    if (disposed || !api || (save && !store.durable)) throw new LibraryError('unsupported')
    const existing = jobs.get(id)
    if (existing) return existing.completion
    if (queue.length >= 100) { emit({ error: 'capacity' }); throw new LibraryError('capacity') }
    const generation = epoch(id), controller = new AbortController()
    const valid = () => !disposed && !controller.signal.aborted && epoch(id) === generation
    let result: Bundle | undefined
    let resolveCompletion!: (bundle: Bundle | undefined) => void
    const completion = new Promise<Bundle | undefined>(resolve => { resolveCompletion = resolve })
    const promise = new Promise<void>(done => {
      const job: Job = { id, completion, controller, done: () => { done(); resolveCompletion(result) }, run: async () => {
        try {
          if (!valid()) throw new LibraryError('cancelled')
          if (save) {
            await store.intent(environment, id)
            if (!valid()) throw new LibraryError('cancelled')
            if (!item(id)) emit({ items: [...state.items, { id, bundle: null, savedAt: null, verifiedAt: null }] })
          }
          const old = item(id)?.bundle
          let bundle = await api.bundle(id, controller.signal, old?.revision)
          if (!valid()) throw new LibraryError('cancelled')
          if (bundle === null) {
            // A 304 is useful only for the intact revision actually held on disk now.
            const disk = await store.hydrate(environment)
            const intact = disk.items.find(i => i.id === id)?.bundle
            if (!valid()) throw new LibraryError('cancelled')
            if (old && intact?.revision === old.revision) {
              if (save) { await store.verify(environment, id, now()); if (!valid()) throw new LibraryError('cancelled'); emit({ items: state.items.map(i => i.id === id ? { ...i, verifiedAt: now() } : i) }) }
              result = old; return
            }
            bundle = await api.bundle(id, controller.signal)
            if (bundle === null) throw new LibraryError('invalid')
          }
          bundle = parseBundle(bundle, id)
          const expected = state.catalog.find(i => i.id === id)?.revision
          if (expected && bundle.revision !== expected) {
            // One unconditional per-item revalidation handles a catalog/download snapshot race.
            const checked = await api.bundle(id, controller.signal)
            if (!checked || checked.revision !== bundle.revision) throw new LibraryError('invalid')
            bundle = parseBundle(checked, id)
          }
          if (!valid()) throw new LibraryError('cancelled')
          if (save && old?.revision === bundle.revision) {
            const intact = (await store.hydrate(environment)).items.find(i => i.id === id)?.bundle
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
          if (valid() && code === 'unavailable') { try { await remove(id, true) } catch { /* Storage error is visible. */ } }
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
    await promise
    return result
  }
  function cancel() {
    cancellation++
    catalogController?.abort()
    for (const [id, job] of jobs) {
      job.controller.abort()
      emit({ status: { ...state.status, [id]: 'cancelled' } })
    }
  }
  return {
    environment, durable: store.durable, enabled: !!api,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    hydrate, refresh, remove, request,
    async sync() { const started = cancellation; await hydrate(); if (started === cancellation) await Promise.all(state.items.map(i => request(i.id, true))) },
    async dismiss() { try { await store.dismiss(environment); emit({ dismissed: true }) } catch { emit({ error: 'storage' }) } },
    cancel,
    dispose() { cancel(); disposed = true; for (const job of queue.splice(0)) job.done(); listeners.clear() },
  }
}
export type LibraryController = ReturnType<typeof createLibrary>
