import type { KnownSessionStatus } from '@tarkman/core'
import { normalizeSession, record, type LiveSession } from '../live/contracts'
import type { AuthContextValue } from '../auth/AuthProvider'

export interface MyService extends LiveSession { date: string | null }

export interface MyServicesPage { services: MyService[]; nextCursor: string | null }

/** Opt in to cursor pagination; older servers may still return the complete legacy list. */
export async function fetchMyServices(authorizedFetch: AuthContextValue['authorizedFetch'], signal: AbortSignal, cursor?: string | null): Promise<MyServicesPage> {
  const path = `/s.json?pagination=cursor&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  const response = await authorizedFetch(path, { signal })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    if (response.status === 400 && data?.error === 'invalid_cursor') {
      throw Object.assign(new Error('Your services have changed. Please retry.'), { code: 'invalid_cursor' })
    }
    throw new Error('Could not load your services. Please retry.')
  }
  const page = normalizeMyServicesPage(await response.json())
  if (cursor && page.nextCursor === cursor) throw new Error('Unexpected services pagination.')
  return page
}

export function normalizeMyServicesPage(value: unknown): MyServicesPage {
  const data = record(value)
  const services = normalizeMyServices(value)
  if (data.page === undefined) return { services, nextCursor: null }
  const page = record(data.page)
  if (!Array.isArray(data.sessions) || !Number.isSafeInteger(page.limit) || (page.limit as number) <= 0 ||
    typeof page.has_more !== 'boolean' ||
    (page.has_more ? typeof page.next_cursor !== 'string' || !page.next_cursor.trim() : page.next_cursor !== null)) {
    throw new Error('Unexpected services pagination.')
  }
  return { services, nextCursor: page.has_more ? page.next_cursor as string : null }
}

export function normalizeMyServices(value: unknown): MyService[] {
  const data = record(value)
  if (Array.isArray(data.sessions)) return data.sessions.map(item => {
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

/**
 * `STATUS_LABELS` from @tarkman/core, verbatim. The core package re-exports with `.js` specifiers that this app's
 * bundler and tests do not resolve, so only its types are imported here; tests/service-controls.test.ts keeps the two identical.
 */
export const STATUS_LABELS: Record<KnownSessionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  showing_gospel: 'Gospel Reading',
  showing_epistle: 'Epistle Reading',
  showing_welcome: 'Welcome Message',
  showing_custom: 'Custom Announcement',
}

export function statusLabel(status: string): string {
  const words = status.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
