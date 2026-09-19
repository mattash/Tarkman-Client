import { t } from '../i18n'
import { normalizeSession, record, type LiveSession } from '../live/contracts'
import type { DisplayLinkConfig } from './config'
import { normalizeConfig } from './normalize'

export class InvalidDisplayLinkError extends Error {}

/** Fetches a display-link configuration. The endpoint is unauthenticated; the token is its own capability. */
export async function fetchDisplayLink(
  base: string,
  token: string,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DisplayLinkConfig> {
  const response = await request(`${base}/display_links/${encodeURIComponent(token)}`, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'application/json' },
  })
  if ([404, 410, 403].includes(response.status)) throw new InvalidDisplayLinkError(t('display.invalidLink'))
  if (!response.ok) throw new Error(t('display.couldNotLoad'))
  const data = (await response.json()) as unknown
  const config = normalizeConfig(data)
  if (!config) throw new InvalidDisplayLinkError(t('display.couldNotLoad'))
  return config
}

/** The current endpoint is user-scoped, like the legacy display's church link. */
export async function fetchCurrentDisplaySession(base: string, userId: number, signal: AbortSignal, request: typeof fetch = fetch): Promise<LiveSession | null> {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const response = await request(`${base}/s/${userId}/current.json?tz=${encodeURIComponent(zone)}`, {
    signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/json', 'X-Polling-Client': 'true' },
  })
  if (!response.ok) throw new Error(t('display.discoveryUnavailable'))
  const data = record(await response.json())
  return data.status === 'inactive' ? null : normalizeSession(data)
}
