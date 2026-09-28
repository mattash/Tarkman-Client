import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import { deleteSession, fetchEditSnapshot } from './api'
import { isManagementError, type ManagedSession } from './contracts'

/**
 * idle → preparing (fresh authorized snapshot) → confirming → deleting → deleted.
 * `gone` is a typed missing-session answer: already unavailable, not deleted by this request.
 * `unknown` means neither the DELETE nor a follow-up read could establish the outcome.
 */
export type DeletionPhase = 'idle' | 'preparing' | 'confirming' | 'deleting' | 'deleted' | 'gone' | 'unknown'
export interface DeletionSnapshot {
  phase: DeletionPhase
  /** The exact session and revision the confirmation is for; captured, so a later row or route change cannot retarget it. */
  target: ManagedSession | null
  sessionId: number | null
  error: string | null
}
const initial: DeletionSnapshot = { phase: 'idle', target: null, sessionId: null, error: null }
/**
 * Why a snapshot is being read: before the first confirmation; after a definite 409 (nothing was deleted);
 * or after an unknown DELETE outcome, where a missing session means this request most likely deleted it.
 */
type ReadMode = 'prepare' | 'stale' | 'uncertain'

export function createDeletionController(fetcher: AuthContextValue['authorizedFetch']) {
  let snapshot = initial
  let disposed = false
  let locked = false
  let generation = 0
  let request: AbortController | null = null
  const listeners = new Set<() => void>()
  const set = (patch: Partial<DeletionSnapshot>) => { if (disposed) return; snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }

  async function read(sessionId: number, epoch: number, mode: ReadMode, message: string | null) {
    request?.abort()
    const controller = new AbortController()
    request = controller
    try {
      const target = await fetchEditSnapshot(fetcher, sessionId, controller.signal)
      if (epoch !== generation) return
      set({ phase: 'confirming', target, error: message })
    } catch (error) {
      if (epoch !== generation || controller.signal.aborted) return
      if (isUnauthorized(error)) { set(initial); return }
      if (isManagementError(error, 'notFound')) {
        if (mode === 'uncertain') set({ phase: 'deleted' })
        else set({ phase: 'gone', target: null, error: t('sessionManagement.alreadyUnavailable') })
        return
      }
      if (mode === 'uncertain') { set({ phase: 'unknown', error: t('sessionManagement.deleteUnknown') }); return }
      const reason = error instanceof Error ? error.message : t('sessionManagement.loadFailed')
      set({ phase: 'idle', target: null, error: mode === 'stale' ? `${t('sessionManagement.deleteStale')} ${reason}` : reason })
    } finally {
      if (request === controller) request = null
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    /** Loads the current authorized snapshot before any confirmation is shown. */
    prepare(sessionId: number) {
      if (locked) return
      const epoch = ++generation
      set({ phase: 'preparing', sessionId, target: null, error: null })
      void read(sessionId, epoch, 'prepare', null)
    },
    /** Cancel before submission sends nothing. */
    cancel() {
      if (locked) return
      generation++; request?.abort()
      set(initial)
    },
    /** The one explicit DELETE for the confirmed target and revision. */
    confirm() {
      const target = snapshot.target
      if (locked || snapshot.phase !== 'confirming' || !target) return
      locked = true // Synchronous: a double tap cannot send twice.
      const epoch = ++generation
      set({ phase: 'deleting', error: null })
      void (async () => {
        try {
          await deleteSession(fetcher, target.id, target.revision)
          if (epoch === generation) set({ phase: 'deleted' })
        } catch (error) {
          if (isUnauthorized(error)) { set(initial); return }
          if (isManagementError(error, 'notFound')) { set({ phase: 'gone', error: t('sessionManagement.alreadyUnavailable') }); return }
          if (isManagementError(error, 'stale')) { await read(target.id, epoch, 'stale', t('sessionManagement.deleteStale')); return }
          if (isManagementError(error, 'uncertain')) { await read(target.id, epoch, 'uncertain', t('sessionManagement.deleteUncertain')); return }
          set({ phase: 'confirming', error: error instanceof Error ? error.message : t('sessionManagement.rejected') })
        } finally {
          locked = false
        }
      })()
    },
    /** For `unknown`: check again, never delete again. */
    recheck() {
      const sessionId = snapshot.target?.id ?? snapshot.sessionId
      if (locked || sessionId === null) return
      const epoch = ++generation
      set({ phase: 'preparing', error: null })
      void read(sessionId, epoch, 'uncertain', t('sessionManagement.deleteUncertain'))
    },
    reset() { if (!locked) { generation++; set(initial) } },
    dispose() { disposed = true; generation++; request?.abort() },
  }
}
export type DeletionController = ReturnType<typeof createDeletionController>
