import { useCallback, useEffect, useState } from 'react'
import type { KeyValueAdapter } from '@tarkman/core'
import { preferencesStore } from '../preferences/storage'

export const RECENTLY_CONTROLLED_KEY = 'tarkman.recently-controlled.v1'
const KEEP = 3

/**
 * Services an operator recently opened the controls of. Scoped to the account
 * (the storage key carries the user id), so one operator's records are never
 * shown to another account on the same device. Kept only on this device.
 */
export interface ControlledService {
  sessionId: number
  title: string
  church: string
  date: string | null
  controlledAt: number
}

export function recentlyControlledKey(userId: number): string {
  return `${RECENTLY_CONTROLLED_KEY}.${userId}`
}

export function readRecentlyControlled(raw: string | null): ControlledService[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.flatMap(value => {
      if (!value || typeof value !== 'object') return []
      const entry = value as Partial<ControlledService>
      if (typeof entry.sessionId !== 'number' || !Number.isSafeInteger(entry.sessionId) || entry.sessionId <= 0) return []
      if (typeof entry.title !== 'string' || typeof entry.church !== 'string') return []
      return [{ sessionId: entry.sessionId, title: entry.title, church: entry.church,
        date: typeof entry.date === 'string' ? entry.date : null,
        controlledAt: typeof entry.controlledAt === 'number' ? entry.controlledAt : 0 }]
    })
  } catch {
    return []
  }
}

/** Records a control visit, most recent first, one row per service. Losing the list must never interrupt control. */
export function recordRecentlyControlled(entry: Omit<ControlledService, 'controlledAt'>, userId: number, store: KeyValueAdapter = preferencesStore): Promise<void> {
  return store.get(recentlyControlledKey(userId)).then(raw => {
    const rest = readRecentlyControlled(raw).filter(service => service.sessionId !== entry.sessionId)
    const next = [{ ...entry, controlledAt: Date.now() }, ...rest].slice(0, KEEP)
    return store.set(recentlyControlledKey(userId), JSON.stringify(next))
  }).catch(() => { /* A missing bookmark is not a control failure. */ }).then(() => {})
}

export function useRecentlyControlled(userId: number | null, store: KeyValueAdapter = preferencesStore) {
  const [services, setServices] = useState<ControlledService[]>([])
  const reload = useCallback(() => {
    let active = true
    const load = userId === null ? Promise.resolve(null) : store.get(recentlyControlledKey(userId))
    load.then(raw => { if (active) setServices(userId === null ? [] : readRecentlyControlled(raw)) }, () => {})
    return () => { active = false }
  }, [userId, store])
  useEffect(reload, [reload])
  return { services, reload }
}
