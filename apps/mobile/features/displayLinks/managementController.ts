import type { DisplayLinkFields, ManagedDisplayLink } from '@tarkman/core'
import { isUnauthorized } from '../auth/AuthProvider'
import { t } from '../i18n'
import { CREATE_DEFAULTS, changedFields, fieldsOf, validateDraft } from './draft'
import { ManagementError, type FieldErrors, type createManagementApi } from './managementApi'

interface ManagerState {
  links: ManagedDisplayLink[]; baseline?: ManagedDisplayLink; draft: DisplayLinkFields
  loading: boolean; saving: boolean; loaded: boolean; error?: string; fields: FieldErrors
  conflict?: ManagedDisplayLink; uncertain: boolean; reconciled: boolean; unavailable: boolean; saved: boolean
}
/** A route owns this store; disposal aborts and fences every continuation, including mutations. */
export function createManagementController(api: ReturnType<typeof createManagementApi>, token?: string | null) {
  let state: ManagerState = { links: [], draft: { ...CREATE_DEFAULTS }, loading: false, saving: false, loaded: false,
    fields: {}, uncertain: false, reconciled: false, unavailable: false, saved: false }
  let alive = false, epoch = 0, request: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const update = (patch: Partial<ManagerState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  function stop() {
    alive = false; epoch++; request?.abort(); request = undefined; clearTimeout(timer)
    // A blurred route can stay in the stack. Never leave it permanently busy on return.
    state = { ...state, loading: false, saving: false, uncertain: state.uncertain || state.saving }
  }
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const abort = new AbortController(); request = abort
    let ownTimer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([operation(abort.signal), new Promise<never>((_, reject) => {
        ownTimer = timer = setTimeout(() => { abort.abort(); reject(new Error(t('links.uncertain'))) }, 12000)
      })])
    } finally { clearTimeout(ownTimer); if (request === abort) request = undefined }
  }
  async function load(reconcile = false) {
    if (!alive || request) return
    const generation = epoch
    update({ loading: true, error: undefined })
    try {
      const links = await run(signal => api.list(signal))
      if (!alive || generation !== epoch) return
      update({ links, loaded: true, reconciled: reconcile })
      const savedToken = state.baseline?.token ?? token
      if (savedToken) {
        const baseline = links.find(link => link.token === savedToken)
        if (!baseline) { update({ unavailable: true, error: t('links.unavailable') }); return }
        if (!state.baseline) update({ baseline, draft: fieldsOf(baseline) })
        else if (reconcile) update({ conflict: baseline })
      }
    } catch (error) {
      if (alive && generation === epoch && !isUnauthorized(error)) update({ error: t('links.loadFailed') })
    } finally { if (alive && generation === epoch) update({ loading: false }) }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() { alive = true; void load(); return stop },
    refresh: () => load(),
    reconcile: () => load(true),
    edit(patch: Partial<DisplayLinkFields>) {
      if (state.saving || state.unavailable) return
      update({ draft: { ...state.draft, ...patch }, saved: false, fields: {} })
    },
    review(selected: (keyof DisplayLinkFields)[]) {
      if (!state.conflict || state.saving) return
      const baseline = state.conflict, draft = { ...fieldsOf(baseline), ...Object.fromEntries(selected.map(key => [key, state.draft[key]])) }
      update({ baseline, draft, conflict: undefined, uncertain: false, reconciled: false, error: undefined, fields: {} })
    },
    async save() {
      if (!alive || request || state.saving || !state.loaded || state.unavailable || state.uncertain || state.conflict || token === undefined) return
      const fields = validateDraft(state.draft)
      if (Object.keys(fields).length) { update({ fields, error: t('links.validation') }); return }
      const baseline = state.baseline, changes = baseline ? changedFields(baseline, state.draft) : fieldsOf(state.draft)
      if (baseline && !Object.keys(changes).length) return
      const generation = epoch
      update({ saving: true, error: undefined, fields: {}, saved: false })
      try {
        const result = await run(signal => api.save(changes, signal, baseline))
        if (!alive || generation !== epoch) return
        update({ baseline: result, draft: fieldsOf(result), saved: true,
          links: [result, ...state.links.filter(link => link.token !== result.token)] })
      } catch (error) {
        if (!alive || generation !== epoch || isUnauthorized(error)) return
        if (error instanceof ManagementError && error.status === 409) {
          const current = error.current?.token === baseline?.token ? error.current : undefined
          update({ error: t('links.conflict'), conflict: current })
          if (!current) {
            update({ uncertain: true }); await load(true)
          }
        } else if (error instanceof ManagementError && error.status === 422) update({ error: error.message, fields: error.fields })
        else if (error instanceof ManagementError && [401, 403, 404].includes(error.status)) update({ unavailable: true, error: error.message })
        else update({ uncertain: true, reconciled: false, error: t('links.uncertain') })
      } finally { if (alive && generation === epoch) update({ saving: false }) }
    },
  }
}
