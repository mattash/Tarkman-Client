export { STATUS_LABELS } from '@tarkman/core'
import { normalizeSession, record, type LiveSession } from '../live/contracts'
import type { AuthContextValue } from '../auth/AuthProvider'
import { activeInterfaceLanguage, DEFAULT_INTERFACE_LANGUAGE, formatLocale, statusName, t } from '../i18n'

export interface MyService extends LiveSession { date: string | null }

export interface MyServicesPage { services: MyService[]; nextCursor: string | null }

/** Opt in to cursor pagination; older servers may still return the complete legacy list. */
export async function fetchMyServices(authorizedFetch: AuthContextValue['authorizedFetch'], signal: AbortSignal, cursor?: string | null): Promise<MyServicesPage> {
  const path = `/s.json?pagination=cursor&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  const response = await authorizedFetch(path, { signal })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    if (response.status === 400 && data?.error === 'invalid_cursor') {
      throw Object.assign(new Error(t('myServices.changed')), { code: 'invalid_cursor' })
    }
    throw new Error(t('myServices.loadFailed'))
  }
  const page = normalizeMyServicesPage(await response.json())
  if (cursor && page.nextCursor === cursor) throw new Error(t('errors.unexpectedPagination'))
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
    throw new Error(t('errors.unexpectedPagination'))
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
  if (data.error === 'No sessions found') return [] // i18n-ignore: the server's wording, matched, never shown
  throw new Error(t('errors.unexpectedServices'))
}

/** Service dates are calendar dates (`YYYY-MM-DD`); formatting in UTC keeps them from shifting a day by time zone. */
export function formatServiceDate(date: string | null): string | null {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(formatLocale(), { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** The status as sent ("Showing gospel") in English; another interface language names the statuses it knows. */
export function statusLabel(status: string): string {
  if (activeInterfaceLanguage() !== DEFAULT_INTERFACE_LANGUAGE) return statusName(status)
  const words = status.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
