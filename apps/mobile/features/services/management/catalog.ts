import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import { fetchLiturgyOptions } from './api'
import { isManagementError, type LiturgyOption } from './contracts'

/** A guard against a server that never ends its keyset chain; far above any real catalog. */
const MAX_PAGES = 40

export interface CatalogSnapshot {
  liturgies: LiturgyOption[]
  loading: boolean
  error: string | null
  unavailable: boolean
  /** True once every page has loaded, so a local title filter covers the whole eligible catalog. */
  complete: boolean
}

const initial: CatalogSnapshot = { liturgies: [], loading: false, error: null, unavailable: false, complete: false }

/** Case- and accent-insensitive title match for the Add Liturgy sheet's filter. */
export function matchesTitle(name: string, query: string): boolean {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  const title = fold(name)
  return words.every(word => title.includes(word))
}

/**
 * The authenticated catalog of liturgies this account may add, loaded in full (every keyset page) the first
 * time the Add Liturgy sheet opens, then filtered on the device. Selections live in the form, never here.
 */
export function createCatalogController(fetcher: AuthContextValue['authorizedFetch']) {
  let snapshot = initial
  let active: AbortController | null = null
  let generation = 0
  const listeners = new Set<() => void>()
  const set = (patch: Partial<CatalogSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }

  async function loadAll() {
    active?.abort()
    const controller = new AbortController()
    active = controller
    const epoch = ++generation
    set({ loading: true, error: null, unavailable: false })
    try {
      const liturgies = new Map<number, LiturgyOption>()
      let after: number | null = null
      for (let page = 0; ; page++) {
        if (page >= MAX_PAGES) throw new Error(t('sessionManagement.catalogFailed'))
        const result = await fetchLiturgyOptions(fetcher, controller.signal, '', after)
        if (epoch !== generation) return
        for (const item of result.liturgies) liturgies.set(item.id, item)
        // A continuation must move forward; anything else would loop.
        if (result.nextAfterId === null) break
        if (after !== null && result.nextAfterId <= after) throw new Error(t('sessionManagement.catalogFailed'))
        after = result.nextAfterId
      }
      set({ liturgies: [...liturgies.values()], complete: true })
    } catch (error) {
      if (epoch !== generation || controller.signal.aborted || isUnauthorized(error)) return
      // A failed load is never shown as an empty catalog.
      set({ liturgies: [], complete: false, error: error instanceof Error ? error.message : t('sessionManagement.catalogFailed'),
        unavailable: isManagementError(error, 'unavailable') })
    } finally {
      if (epoch === generation) { active = null; set({ loading: false }) }
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    /** Loads once; later opens reuse the loaded catalog. */
    ensureLoaded() { if (!snapshot.complete && !snapshot.loading && !snapshot.error) void loadAll() },
    retry: () => loadAll(),
    dispose() { generation++; active?.abort(); active = null },
  }
}
export type CatalogController = ReturnType<typeof createCatalogController>
