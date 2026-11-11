import { randomUUID } from 'expo-crypto'
import { isUnauthorized, type AuthContextValue } from '../../auth/AuthProvider'
import { t } from '../../i18n'
import type { ReadingPatch } from '../../lectionary'
import { createSession, fetchBootstrap, type CreateAttempt } from './api'
import { isManagementError, OPTION_KEYS, type ManagedSession, type ManagementBootstrap, type ManagementErrorKind, type OptionKey } from './contracts'
import { draftSetup, EMPTY_OPTIONS, localErrors, mapFieldErrors, sameDraft, type FormField, type SessionDraft } from './draft'

/** mattash/Tarkman#454 keeps a creation receipt for 24 hours; after that the same key must never be replayed. */
export const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000
/** A bootstrap older than this is refreshed on focus so a draft started before midnight gets the new default day. */
const BOOTSTRAP_TTL_MS = 30 * 60 * 1000

export type CreationPhase = 'editing' | 'pending' | 'uncertain' | 'expired' | 'created'
export interface CreationSnapshot {
  bootstrap: ManagementBootstrap | null
  bootstrapLoading: boolean
  /** The form's own bootstrap failure; a My Sessions list failure never implies this. */
  bootstrapError: string | null
  unavailable: boolean
  draft: SessionDraft
  /** Defaults the draft started from, for dirty detection. */
  baseline: SessionDraft
  phase: CreationPhase
  error: string | null
  errorKind: ManagementErrorKind | null
  fields: Partial<Record<FormField, string>>
  otherErrors: string[]
  /** Bumps whenever validation should move focus to the first invalid field. */
  focusRequest: number
  created: ManagedSession | null
  replayed: boolean
}

const blank: SessionDraft = { date: '', liturgies: [], options: EMPTY_OPTIONS }
const initial: CreationSnapshot = { bootstrap: null, bootstrapLoading: true, bootstrapError: null, unavailable: false, draft: blank, baseline: blank,
  phase: 'editing', error: null, errorKind: null, fields: {}, otherErrors: [], focusRequest: 0, created: null, replayed: false }

export function isDirty(snapshot: CreationSnapshot): boolean {
  return !!snapshot.bootstrap && !sameDraft(snapshot.draft, snapshot.baseline)
}

/**
 * One creation form's lifetime, scoped by its owner to one API environment and account.
 * Nothing is written until `submit`; the in-flight lock is synchronous so repeated taps cannot race
 * React; an uncertain outcome keeps the exact request (key and payload) for a deliberate same-key retry.
 */
export function createCreationController(fetcher: AuthContextValue['authorizedFetch'], options: { now?: () => number; uuid?: () => string } = {}) {
  const now = options.now ?? Date.now, uuid = options.uuid ?? randomUUID
  let snapshot = initial
  let bootstrapRequest: AbortController | null = null
  let bootstrapAt = 0
  let disposed = false
  let inFlight = false
  let attempt: CreateAttempt | null = null
  /** Fields the person has changed: a late bootstrap may update the others, never these. */
  const touched = new Set<'date' | OptionKey>()
  const listeners = new Set<() => void>()
  const set = (patch: Partial<CreationSnapshot>) => { if (disposed) return; snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }
  const locked = () => snapshot.phase !== 'editing' || !snapshot.bootstrap

  async function loadBootstrap() {
    if (disposed || bootstrapRequest) return
    const controller = new AbortController()
    bootstrapRequest = controller
    set({ bootstrapLoading: true, bootstrapError: null })
    try {
      const bootstrap = await fetchBootstrap(fetcher, controller.signal)
      if (controller.signal.aborted) return
      bootstrapAt = now()
      // A sent request is fixed: while its outcome is open the form keeps showing exactly what was sent.
      if (snapshot.bootstrap && snapshot.phase !== 'editing') { set({ bootstrap: { ...bootstrap, defaultDate: snapshot.bootstrap.defaultDate } }); return }
      const defaults: SessionDraft = { date: bootstrap.defaultDate, liturgies: [], options: { ...EMPTY_OPTIONS, ...bootstrap.defaultOptions } }
      const { draft } = snapshot
      // Defaults only initialize: anything the person already changed stays exactly as they left it.
      const next: SessionDraft = { date: touched.has('date') ? draft.date : defaults.date, liturgies: draft.liturgies,
        options: Object.fromEntries(OPTION_KEYS.map(key => [key, touched.has(key) ? draft.options[key] : defaults.options[key]])) as SessionDraft['options'] }
      set({ bootstrap, draft: next, baseline: defaults, unavailable: false })
    } catch (error) {
      if (controller.signal.aborted || isUnauthorized(error)) return
      // Unsupported or forbidden is final for this form; anything else can be retried.
      const final = isManagementError(error, 'unavailable') || isManagementError(error, 'forbidden')
      set({ bootstrapError: isManagementError(error, 'forbidden') ? t('sessionManagement.createForbidden') : error instanceof Error ? error.message : t('sessionManagement.loadFailed'),
        unavailable: final })
    } finally {
      if (bootstrapRequest === controller) { bootstrapRequest = null; set({ bootstrapLoading: false }) }
    }
  }

  function edit(update: (draft: SessionDraft) => SessionDraft, field?: 'date' | OptionKey | ('date' | OptionKey)[]) {
    if (locked()) return
    const changed = field ? Array.isArray(field) ? field : [field] : []
    changed.forEach(key => touched.add(key))
    const draft = update(snapshot.draft)
    if (draft === snapshot.draft) return
    const fields = { ...snapshot.fields }
    changed.forEach(key => { delete fields[key] })
    if (draft.liturgies !== snapshot.draft.liturgies) delete fields.liturgy_ids
    // Once every highlighted field is fixed, the summary no longer applies; server-wide notes are stale after an edit.
    const settled = snapshot.errorKind === 'validation' && Object.keys(fields).length === 0
    set({ draft, fields, ...(settled ? { error: null, errorKind: null, otherErrors: [] } : {}) })
  }

  async function send(request: CreateAttempt, retry = false) {
    inFlight = true
    set({ phase: 'pending', error: null, errorKind: null, otherErrors: [] })
    try {
      const result = await createSession(fetcher, request)
      if (disposed) return
      attempt = null
      set({ phase: 'created', created: result.session, replayed: result.replayed, baseline: snapshot.draft })
    } catch (error) {
      if (disposed) return
      if (isUnauthorized(error)) {
        // Sign-in ended. Stop: nothing is resubmitted after signing in again without another deliberate action.
        attempt = null; set({ phase: 'editing', error: t('signIn.expired'), errorKind: null }); return
      }
      const kind = isManagementError(error) ? error.kind : 'uncertain'
      const message = error instanceof Error ? error.message : t('sessionManagement.uncertain')
      if (kind === 'uncertain') { set({ phase: 'uncertain', error: message, errorKind: kind }); return }
      // A busy, refused or unreadable answer to a retry says nothing about the first request, which may
      // have been saved: keep its key so the only way forward is another same-key retry or checking the list.
      if (retry && (kind === 'network' || kind === 'rejected' || kind === 'unavailable' || kind === 'validation')) {
        set({ phase: 'uncertain', error: `${message} ${t('sessionManagement.uncertain')}`, errorKind: 'uncertain' }); return
      }
      // A definite answer: the server did not keep this attempt, so the next deliberate Create gets a fresh key.
      attempt = null
      if (kind === 'validation' && isManagementError(error)) {
        const { byField, other } = mapFieldErrors(error.fields)
        set({ phase: 'editing', error: message, errorKind: kind, fields: byField, otherErrors: other, focusRequest: snapshot.focusRequest + 1 })
        return
      }
      set({ phase: 'editing', error: message, errorKind: kind })
    } finally {
      inFlight = false
    }
  }

  /** Validates locally; returns false (with focus moved to the first problem) when the draft cannot be sent. */
  function validate(): boolean {
    const fields = localErrors(snapshot.draft, snapshot.bootstrap?.limits)
    if (Object.keys(fields).length === 0) return true
    set({ fields, otherErrors: [], error: t('sessionManagement.fixErrors'), errorKind: 'validation', focusRequest: snapshot.focusRequest + 1 })
    return false
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    /** For focus: loads the bootstrap once, and refreshes an old one without touching edited fields. */
    focus() {
      if (!snapshot.bootstrap || (snapshot.phase === 'editing' && now() - bootstrapAt > BOOTSTRAP_TTL_MS)) void loadBootstrap()
    },
    retryBootstrap: () => loadBootstrap(),
    setDate: (date: string) => edit(draft => ({ ...draft, date }), 'date'),
    setOption: (key: OptionKey, value: string) => edit(draft => ({ ...draft, options: { ...draft.options, [key]: value } }), key),
    /** Apply only to the exact editable draft that was previewed; never create or send a control command. */
    applyReadings(expected: SessionDraft, patch: ReadingPatch): boolean {
      if (locked() || !sameDraft(snapshot.draft, expected)) return false
      const keys = (['gospel', 'epistle', 'prophetic'] as const).filter(key => typeof patch[key] === 'string' && patch[key]!.length > 0)
      if (!keys.length) return false
      // Applying a date's readings deliberately pins that date across later midnight bootstrap refreshes.
      edit(draft => ({ ...draft, options: { ...draft.options, ...Object.fromEntries(keys.map(key => [key, patch[key]])) } }), ['date', ...keys])
      return true
    },
    update: (change: (draft: SessionDraft) => SessionDraft) => edit(change),
    validate,
    /** Explicit Create. Returns without sending when locked, invalid, or already in flight. */
    submit() {
      if (inFlight || locked() || !validate()) return
      inFlight = true // Taken before any await or render.
      attempt = { clientRequestId: uuid(), setup: draftSetup(snapshot.draft), startedAt: now() }
      void send(attempt)
    },
    /** Same key, same payload, only within the backend's retry window. */
    retrySafely() {
      if (inFlight || snapshot.phase !== 'uncertain' || !attempt) return
      if (now() - attempt.startedAt >= RETRY_WINDOW_MS) { set({ phase: 'expired', error: t('sessionManagement.expired'), errorKind: 'uncertain' }); return }
      inFlight = true
      void send(attempt, true)
    },
    /** The request key currently held for a safe retry, for tests and diagnostics. */
    pendingAttempt: () => attempt,
    dispose() { disposed = true; bootstrapRequest?.abort(); bootstrapRequest = null },
  }
}
export type CreationController = ReturnType<typeof createCreationController>
