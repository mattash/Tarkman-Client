import { t } from '../i18n'
import type { DisplayLinkConfig } from './config'
import { normalizeConfig } from './normalize'

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
  if (response.status === 404) throw new Error(t('display.invalidLink'))
  if (!response.ok) throw new Error(t('display.couldNotLoad'))
  const data = (await response.json()) as unknown
  const config = normalizeConfig(data)
  if (!config) throw new Error(t('display.couldNotLoad'))
  return config
}
