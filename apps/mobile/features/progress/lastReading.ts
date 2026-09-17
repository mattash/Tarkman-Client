import { useCallback, useEffect, useState } from 'react'
import type { KeyValueAdapter } from '@tarkman/core'
import { preferencesStore } from '../preferences/storage'
import { formatLocale, t } from '../i18n'

export const LAST_READING_KEY = 'tarkman.last-reading.v1'

/** Where a reader stopped. Kept only on this device; reading never needs an account. */
export interface LastReading {
  sessionId: number
  title: string
  church: string
  date: string | null
  role: string | null
}

export function readLastReading(raw: string | null): LastReading | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<LastReading>
    if (typeof data.sessionId !== 'number' || !Number.isSafeInteger(data.sessionId) || data.sessionId <= 0) return null
    if (typeof data.title !== 'string' || typeof data.church !== 'string') return null
    return { sessionId: data.sessionId, title: data.title, church: data.church,
      date: typeof data.date === 'string' ? data.date : null, role: typeof data.role === 'string' ? data.role : null }
  } catch {
    return null
  }
}

export function saveLastReading(reading: LastReading, store: KeyValueAdapter = preferencesStore): Promise<void> {
  return store.set(LAST_READING_KEY, JSON.stringify(reading)).catch(() => { /* Losing a bookmark must never interrupt reading. */ })
}

export function useLastReading(store: KeyValueAdapter = preferencesStore) {
  const [reading, setReading] = useState<LastReading | null>(null)
  const reload = useCallback(() => {
    let active = true
    store.get(LAST_READING_KEY).then(raw => { if (active) setReading(readLastReading(raw)) }, () => {})
    return () => { active = false }
  }, [store])
  useEffect(reload, [reload])
  return { reading, reload }
}

/** "Today", "Yesterday", "Last Sunday" within a week, otherwise a short date. */
export function relativeServiceDay(date: string | null, now = new Date()): string | null {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const service = new Date(year, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - service.getTime()) / 86_400_000)
  if (days === 0) return t('days.today')
  if (days === 1) return t('days.yesterday')
  if (days > 1 && days < 7) return t('days.lastWeekday', { weekday: service.toLocaleDateString(formatLocale(), { weekday: 'long' }) })
  return service.toLocaleDateString(formatLocale(), { month: 'short', day: 'numeric' })
}

export function roleLabel(role: string): string {
  const words = role.trim().replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
