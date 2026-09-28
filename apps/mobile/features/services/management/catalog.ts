import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import { fetchLiturgyOptions } from './api'
import { isManagementError, type LiturgyOption } from './contracts'

export interface CatalogSnapshot {
  query: string
  liturgies: LiturgyOption[]
  nextAfterId: number | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  unavailable: boolean
  /** True once the server has said this query has no further pages. */
  complete: boolean
}

const initial: CatalogSnapshot = { query: '', liturgies: [], nextAfterId: null, loading: false, loadingMore: false, error: null, unavailable: false, complete: false }

/**
 * The authenticated, server-searched liturgy picker catalog. A new query resets the continuation and
 * supersedes every earlier request, so an obsolete page can never land in the current results.
 * Selections live in the form, never here: they survive searching and paging.
 */
export function createCatalogController(fetcher: AuthContextValue['authorizedFetch']) {
  let snapshot = initial
  let active: AbortController | null = null
  let generation = 0
  let started = false
  const listeners = new Set<() => void>()
  const set = (patch: Partial<CatalogSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }

  async function load(more: boolean) {
    if (more && (active || snapshot.nextAfterId === null || snapshot.error)) return
    active?.abort()
    const controller = new AbortController()
    active = controller
    const epoch = ++generation
    const { query } = snapshot
    set(more ? { loadingMore: true, error: null } : { loading: true, error: null, unavailable: false })
    try {
      const page = await fetchLiturgyOptions(fetcher, controller.signal, query, more ? snapshot.nextAfterId : null)
      if (epoch !== generation) return
      const liturgies = more ? [...snapshot.liturgies, ...page.liturgies] : page.liturgies
      set({ liturgies: [...new Map(liturgies.map(item => [item.id, item])).values()], nextAfterId: page.nextAfterId, complete: page.nextAfterId === null })
    } catch (error) {
      if (epoch !== generation || controller.signal.aborted || isUnauthorized(error)) return
      set({ error: error instanceof Error ? error.message : t('sessionManagement.catalogFailed'), unavailable: isManagementError(error, 'unavailable') })
    } finally {
      if (epoch === generation) { active = null; set({ loading: false, loadingMore: false }) }
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    start() { if (!started) { started = true; void load(false) } },
    search(query: string) {
      if (query === snapshot.query && started) return
      started = true
      set({ query, liturgies: [], nextAfterId: null, complete: false })
      void load(false)
    },
    loadMore: () => load(true),
    retry() { set({ error: null }); return load(snapshot.liturgies.length > 0 && snapshot.nextAfterId !== null) },
    dispose() { generation++; active?.abort(); active = null },
  }
}
export type CatalogController = ReturnType<typeof createCatalogController>
