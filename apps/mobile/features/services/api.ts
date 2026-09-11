import { normalizeSession, record, type LiveSession } from '../live/contracts'
import type { AuthContextValue } from '../auth/AuthProvider'

export interface MyService extends LiveSession { date: string | null }

/** The signed-in user's own services, newest first (`GET /s.json`). */
export async function fetchMyServices(authorizedFetch: AuthContextValue['authorizedFetch'], signal: AbortSignal): Promise<MyService[]> {
  const response = await authorizedFetch('/s.json', { signal })
  if (!response.ok) throw new Error('Could not load your services. Please retry.')
  return normalizeMyServices(await response.json())
}

export function normalizeMyServices(value: unknown): MyService[] {
  const data = record(value)
  if (Array.isArray(data.sessions)) return data.sessions.slice(0, 10).map(item => {
    const date = record(record(item).session).date
    return { ...normalizeSession(item), date: typeof date === 'string' ? date : null }
  })
  // The API reports an empty list as `{ error: 'No sessions found' }` with a 200 status.
  if (data.error === 'No sessions found') return []
  throw new Error('Unexpected services response.')
}

/** Service dates are calendar dates (`YYYY-MM-DD`); formatting in UTC keeps them from shifting a day by time zone. */
export function formatServiceDate(date: string | null): string | null {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function statusLabel(status: string): string {
  const words = status.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
