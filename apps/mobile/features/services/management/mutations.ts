import { useCallback, useSyncExternalStore } from 'react'

/**
 * A confirmed management write, announced to My Sessions so it can reconcile its owned list.
 * Scoped to an API environment and account: another sign-in never sees, or reacts to, this notice.
 */
export interface MutationNotice {
  kind: 'created' | 'saved' | 'deleted'
  scope: string
  session: { id: number; title: string; date: string | null }
  sequence: number
}

let latest: MutationNotice | null = null
let sequence = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())

export function managementScope(api: string | undefined, userId: number): string {
  return `${api ?? ''}\n${userId}`
}

export function announceMutation(notice: Omit<MutationNotice, 'sequence'>): MutationNotice {
  latest = { ...notice, sequence: ++sequence }
  notify()
  return latest
}

export function dismissMutation(notice: MutationNotice) {
  if (latest?.sequence !== notice.sequence) return
  latest = null
  notify()
}

/** Forget every notice, e.g. on sign-out. */
export function clearMutations() {
  if (!latest) return
  latest = null
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The latest notice for this scope only. */
export function useMutationNotice(scope: string | null): MutationNotice | null {
  const read = useCallback(() => latest && latest.scope === scope ? latest : null, [scope])
  return useSyncExternalStore(subscribe, read, read)
}
