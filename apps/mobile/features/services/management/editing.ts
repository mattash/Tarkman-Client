import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import { fetchEditSnapshot, updateSession } from './api'
import {
  isManagementError, normalizeManagedSession, OPTION_KEYS, setupDiff, setupOf, type ManagedSession, type ManagementErrorKind, type OptionKey, type SessionPatch,
} from './contracts'
import { draftSetup, EMPTY_OPTIONS, localErrors, mapFieldErrors, sameDraft, type FormField, type SessionDraft } from './draft'

export type EditPhase = 'editing' | 'saving' | 'uncertain' | 'saved'
/** A 409 `cursor_reset_required`: the reviewed revision and, when the backend names it, where the session would move. */
export interface CursorReset { revision: number; destination: string | null }
export interface EditSnapshot {
  loading: boolean
  loadError: string | null
  /** Denied, missing, or unsupported: the session is not editable here at all. */
  final: boolean
  baseline: ManagedSession | null
  draft: SessionDraft
  phase: EditPhase
  error: string | null
  errorKind: ManagementErrorKind | null
  fields: Partial<Record<FormField, string>>
  otherErrors: string[]
  focusRequest: number
  /** The freshly authorized saved version after a stale save, awaiting review. */
  conflict: ManagedSession | null
  /** Why `conflict` is shown: another save or live move, or this editor's own unconfirmed save that did not land. */
  conflictReason: 'stale' | 'unconfirmed' | null
  reset: CursorReset | null
  /** The persisted result of this editor's last successful save. */
  committed: ManagedSession | null
}

const blank: SessionDraft = { date: '', liturgies: [], options: EMPTY_OPTIONS }
const initial: EditSnapshot = { loading: true, loadError: null, final: false, baseline: null, draft: blank, phase: 'editing', error: null, errorKind: null,
  fields: {}, otherErrors: [], focusRequest: 0, conflict: null, conflictReason: null, reset: null, committed: null }

export function draftOf(session: ManagedSession): SessionDraft {
  return { date: session.date, liturgies: session.liturgies.map(item => ({ ...item })), options: { ...EMPTY_OPTIONS, ...session.options } }
}
export function isEditDirty(snapshot: EditSnapshot): boolean {
  return !!snapshot.baseline && !sameDraft(snapshot.draft, draftOf(snapshot.baseline))
}
/** The deliberate changes only: key-wise options, liturgies only when membership or order changed. */
export function pendingChanges(snapshot: EditSnapshot): SessionPatch | null {
  return snapshot.baseline ? setupDiff(setupOf(snapshot.baseline), draftSetup(snapshot.draft)) : null
}

/** Rebases local changes onto a fresh saved version: only what the person changed is carried across. */
export function reapply(previous: ManagedSession, draft: SessionDraft, fresh: ManagedSession): SessionDraft {
  const changes = setupDiff(setupOf(previous), draftSetup(draft)) ?? {}
  const base = draftOf(fresh)
  const options = { ...base.options }
  for (const key of OPTION_KEYS) if (changes.options && key in changes.options) options[key] = changes.options[key as OptionKey] ?? ''
  return { date: changes.date ?? base.date, liturgies: changes.liturgy_ids ? draft.liturgies.map(item => fresh.liturgies.find(saved => saved.id === item.id) ?? item) : base.liturgies, options }
}

function destination(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const proposed = [data.proposed_cursor, data.proposed_current_part, data.destination].find(item => item && typeof item === 'object') as Record<string, unknown> | undefined
  if (!proposed) return null
  const parts = [proposed.liturgy_name, proposed.role ?? proposed.part_role, typeof proposed.position === 'number' ? `#${proposed.position}` : null]
    .filter((item): item is string => typeof item === 'string' && !!item.trim())
  return parts.length ? parts.join(' · ') : null
}
function revisionOf(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const nested = data.session && typeof data.session === 'object' ? (data.session as Record<string, unknown>).revision : undefined
  const revision = data.revision ?? data.current_revision ?? nested
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : null
}

/**
 * One editor's lifetime for one session, scoped by its owner to an API environment and account.
 * Saved baseline and local draft stay separate; saves are explicit, partial, and revision-guarded.
 */
export function createEditController(fetcher: AuthContextValue['authorizedFetch'], sessionId: number) {
  let snapshot = initial
  let disposed = false
  let inFlight = false
  let request: AbortController | null = null
  const listeners = new Set<() => void>()
  const set = (patch: Partial<EditSnapshot>) => { if (disposed) return; snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }
  const locked = () => snapshot.phase !== 'editing' || !snapshot.baseline || !!snapshot.conflict || !!snapshot.reset

  async function read(): Promise<ManagedSession> {
    request?.abort()
    const controller = new AbortController()
    request = controller
    try { return await fetchEditSnapshot(fetcher, sessionId, controller.signal) } finally { if (request === controller) request = null }
  }
  function finalFailure(error: unknown): boolean {
    return isManagementError(error, 'forbidden') || isManagementError(error, 'notFound') || isManagementError(error, 'unavailable')
  }

  async function load() {
    if (disposed || inFlight) return
    set({ loading: true, loadError: null })
    try {
      const session = await read()
      if (disposed) return
      // Never overwrite a draft the person has changed; a clean one follows the saved version.
      if (!snapshot.baseline || !isEditDirty(snapshot)) set({ baseline: session, draft: draftOf(session) })
    } catch (error) {
      if (disposed || isUnauthorized(error) || (error instanceof Error && error.name === 'AbortError')) return
      set({ loadError: error instanceof Error ? error.message : t('sessionManagement.loadFailed'), final: finalFailure(error) })
    } finally {
      set({ loading: false })
    }
  }

  function edit(update: (draft: SessionDraft) => SessionDraft, field?: FormField) {
    if (locked()) return
    const draft = update(snapshot.draft)
    if (draft === snapshot.draft) return
    const fields = { ...snapshot.fields }
    if (field) delete fields[field]
    if (draft.liturgies !== snapshot.draft.liturgies) delete fields.liturgy_ids
    const settled = snapshot.errorKind === 'validation' && Object.keys(fields).length === 0
    set({ draft, fields, committed: null, ...(settled ? { error: null, errorKind: null, otherErrors: [] } : {}) })
  }

  /** After an unknown PATCH outcome: the saved version decides whether the change landed. */
  async function reconcile() {
    const baseline = snapshot.baseline
    if (!baseline) return
    set({ phase: 'uncertain', loading: true })
    try {
      const fresh = await read()
      if (disposed) return
      if (setupDiff(setupOf(fresh), draftSetup(snapshot.draft)) === null) {
        set({ phase: 'saved', baseline: fresh, draft: draftOf(fresh), committed: fresh, error: null, errorKind: null, loading: false })
        return
      }
      // Not (or not entirely) applied: keep the draft for explicit review against what is saved now.
      set({ phase: 'editing', conflict: fresh, conflictReason: 'unconfirmed', error: t('sessionManagement.uncertainReview'), errorKind: 'stale', loading: false })
    } catch (error) {
      // A read superseded by another one is not an answer; the newer read decides.
      if (disposed || isUnauthorized(error) || (error instanceof Error && error.name === 'AbortError')) return
      set({ phase: 'uncertain', error: t('sessionManagement.uncertain'), errorKind: 'uncertain', loading: false })
    }
  }

  async function send(confirmReset: CursorReset | null) {
    const baseline = snapshot.baseline
    const changes = pendingChanges(snapshot)
    if (!baseline || !changes) return
    inFlight = true
    set({ phase: 'saving', error: null, errorKind: null, otherErrors: [], reset: null })
    try {
      const session = await updateSession(fetcher, sessionId, confirmReset ? confirmReset.revision : baseline.revision, changes, !!confirmReset)
      if (disposed) return
      set({ phase: 'saved', baseline: session, draft: draftOf(session), committed: session })
    } catch (error) {
      if (disposed) return
      if (isUnauthorized(error)) { set({ phase: 'editing', error: t('signIn.expired') }); return }
      const kind = isManagementError(error) ? error.kind : 'uncertain'
      const message = error instanceof Error ? error.message : t('sessionManagement.uncertain')
      // Still in flight while reconciling, so a focus reload cannot cancel the check.
      if (kind === 'uncertain') { await reconcile(); return }
      if (kind === 'stale' && isManagementError(error)) {
        const body = error.body
        const fresh = await (async () => { try { return normalizeManagedSession(body) } catch { return read().catch(() => null) } })()
        if (disposed) return
        set({ phase: 'editing', conflict: fresh, conflictReason: 'stale', error: message, errorKind: kind, ...(fresh ? {} : { loadError: t('sessionManagement.loadFailed') }) })
        return
      }
      if (kind === 'cursorReset' && isManagementError(error)) {
        const revision = revisionOf(error.body)
        // Without the reviewed revision there is nothing safe to confirm against: reload instead.
        if (revision === null) { set({ phase: 'editing', error: t('sessionManagement.stale'), errorKind: 'stale', conflictReason: 'stale', conflict: await read().catch(() => null) }); return }
        set({ phase: 'editing', reset: { revision, destination: destination(error.body) }, error: message, errorKind: kind })
        return
      }
      if (kind === 'validation' && isManagementError(error)) {
        const { byField, other } = mapFieldErrors(error.fields)
        set({ phase: 'editing', error: message, errorKind: kind, fields: byField, otherErrors: other, focusRequest: snapshot.focusRequest + 1 })
        return
      }
      set({ phase: 'editing', error: message, errorKind: kind, final: kind === 'forbidden' || kind === 'notFound' })
    } finally {
      inFlight = false
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    load,
    setDate: (date: string) => edit(draft => ({ ...draft, date }), 'date'),
    setOption: (key: OptionKey, value: string) => edit(draft => ({ ...draft, options: { ...draft.options, [key]: value } }), key),
    update: (change: (draft: SessionDraft) => SessionDraft) => edit(change),
    /** Explicit Save changes: only deliberate changes, against the saved revision. Never on blur, reorder or navigation. */
    save() {
      if (inFlight || locked() || !pendingChanges(snapshot)) return
      const fields = localErrors(snapshot.draft)
      if (Object.keys(fields).length) { set({ fields, error: t('sessionManagement.fixErrors'), errorKind: 'validation', focusRequest: snapshot.focusRequest + 1 }); return }
      inFlight = true // Synchronous: repeated taps cannot race a render.
      void send(null)
    },
    /** The deliberate "Save and reset current part", at the revision the person reviewed. */
    confirmReset() {
      const reset = snapshot.reset
      if (inFlight || !reset || snapshot.phase !== 'editing') return
      inFlight = true
      void send(reset)
    },
    cancelReset() { if (snapshot.reset) set({ reset: null, error: null, errorKind: null }) },
    /** Discard local changes in favour of the saved version. */
    reloadSaved() {
      const fresh = snapshot.conflict
      if (!fresh) return
      set({ baseline: fresh, draft: draftOf(fresh), conflict: null, conflictReason: null, error: null, errorKind: null, fields: {} })
    },
    /** Carry local changes onto the saved version for review; nothing is sent until Save changes. */
    reapply() {
      const { conflict, baseline, draft } = snapshot
      if (!conflict || !baseline) return
      set({ baseline: conflict, draft: reapply(baseline, draft, conflict), conflict: null, conflictReason: null, error: null, errorKind: null })
    },
    /** "Check again" after an unknown outcome; never while another write or check is running. */
    reconcile() { if (inFlight) return; inFlight = true; void reconcile().finally(() => { inFlight = false }) },
    dispose() { disposed = true; request?.abort() },
  }
}
export type EditController = ReturnType<typeof createEditController>
