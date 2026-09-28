import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnauthorized, type AuthContextValue } from '../auth/AuthProvider'
import { fetchMyServices, type MyService } from './api'
import { t } from '../i18n'

interface ServicesState {
  services: MyService[]
  nextCursor: string | null
  loading: boolean
  error: string | null
  refreshing: boolean
  loadingMore: boolean
  loadMoreError: string | null
  paginationComplete: boolean
}
type LoadMode = 'initial' | 'refresh' | 'more'
const initialState: ServicesState = {
  services: [], nextCursor: null, loading: true, error: null,
  refreshing: false, loadingMore: false, loadMoreError: null,
  paginationComplete: false,
}

export function useMyServices(authorizedFetch: AuthContextValue['authorizedFetch']) {
  const [state, setState] = useState(initialState)
  const current = useRef(initialState)
  const active = useRef<AbortController | null>(null)
  const seenCursors = useRef(new Set<string>())
  /** Confirmed-deleted IDs: no response, however late, can bring one back. */
  const removed = useRef(new Set<number>())
  const update = useCallback((patch: Partial<ServicesState>) => {
    current.current = { ...current.current, ...patch }
    setState(current.current)
  }, [])

  const load = useCallback(async (mode: LoadMode, retry = false) => {
    // Lock synchronously: several end-reached events can arrive before React renders.
    if (active.current) return
    const cursor = mode === 'more' ? current.current.nextCursor : null
    if (mode === 'more' && (!cursor || current.current.error || (current.current.loadMoreError && !retry))) return
    const controller = new AbortController()
    active.current = controller
    update({ loading: mode === 'initial', refreshing: mode === 'refresh', loadingMore: mode === 'more', error: null, loadMoreError: null })
    let replacing = mode !== 'more'
    try {
      let page
      try {
        page = await fetchMyServices(authorizedFetch, controller.signal, cursor)
      } catch (failure) {
        if (controller.signal.aborted) return
        if (!(failure instanceof Error) || !('code' in failure) || failure.code !== 'invalid_cursor') throw failure
        // Recovery is deliberately outside the first request's catch: never recurse.
        replacing = true
        page = await fetchMyServices(authorizedFetch, controller.signal)
      }
      if (controller.signal.aborted) return
      if (!replacing && page.nextCursor !== null && seenCursors.current.has(page.nextCursor)) {
        throw new Error(t('errors.unexpectedPagination'))
      }
      // Failed requests preserve the chain; only an accepted replacement resets it.
      if (replacing) seenCursors.current = new Set()
      if (page.nextCursor !== null) seenCursors.current.add(page.nextCursor)
      const services = (replacing ? page.services : [...current.current.services, ...page.services]).filter(service => !removed.current.has(service.id))
      update({ services: [...new Map(services.map(service => [service.id, service])).values()], nextCursor: page.nextCursor,
        paginationComplete: !replacing && page.nextCursor === null })
    } catch (failure) {
      // The signed-in layout handles expired authentication.
      if (controller.signal.aborted || isUnauthorized(failure)) return
      const message = failure instanceof Error ? failure.message : t('myServices.loadFailed')
      update(replacing ? { error: message } : { loadMoreError: message })
    } finally {
      if (active.current === controller) {
        active.current = null
        if (!controller.signal.aborted) update({ loading: false, refreshing: false, loadingMore: false })
      }
    }
  }, [authorizedFetch, update])

  useEffect(() => {
    update(initialState)
    void load('initial')
    return () => { active.current?.abort(); active.current = null }
  }, [load, update])

  /**
   * After a confirmed create/edit/delete: supersede any in-flight page (an old load-more can never append
   * afterwards) and fetch page one again in the server's order. As with any refresh, the cursor chain
   * resets only when that replacement is accepted.
   */
  const reconcile = useCallback((removedId?: number) => {
    active.current?.abort()
    active.current = null
    if (removedId !== undefined) removed.current.add(removedId)
    update({ loadingMore: false, loadMoreError: null, services: current.current.services.filter(service => !removed.current.has(service.id)) })
    return load('refresh')
  }, [load, update])

  return { ...state,
    reconcile,
    refresh: () => load('refresh'),
    retry: () => load(current.current.services.length ? 'refresh' : 'initial'),
    loadMore: () => load('more'),
    retryLoadMore: () => load('more', true),
  }
}
