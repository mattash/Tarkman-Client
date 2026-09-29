import type { ReaderText } from '../adapters'
import { createContracts, type LiveSession } from '../contracts'
import type { DisplayLinkConfig } from './config'
import { completeConfig } from './link-state'
import { normalizeConfig } from './normalize'

export class InvalidDisplayLinkError extends Error {
  constructor(message: string, readonly expired = false) { super(message) }
}

/** The display-link copy the host app owns, resolved at call time like ReaderText. */
export interface DisplayLinkText {
  invalidLink(): string
  couldNotLoad(): string
  discoveryUnavailable(): string
}
export interface DisplayLinkApiOptions {
  base: string; text: ReaderText; linkText: DisplayLinkText
  request?: typeof fetch
  /** The display's IANA zone, so "today" matches the room. Defaults to the runtime's zone. */
  timeZone?: () => string
}
export interface DisplayLinkApi {
  link(token: string, signal?: AbortSignal): Promise<DisplayLinkConfig>
  currentSession(userId: number, signal: AbortSignal): Promise<LiveSession | null>
}
function deviceTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Public, unauthenticated reads. A token is its own capability; no credentials or redirects are followed. */
export function createDisplayLinkApi({ base, text, linkText, request = fetch, timeZone = deviceTimeZone }: DisplayLinkApiOptions): DisplayLinkApi {
  const { normalizeSession } = createContracts(text)
  return {
    /** Fetches a display-link configuration. The endpoint is unauthenticated. */
    async link(token, signal) {
      const response = await request(`${base}/display_links/${encodeURIComponent(token)}`, {
        signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        headers: { Accept: 'application/json' },
      })
      if ([404, 410, 403].includes(response.status)) throw new InvalidDisplayLinkError(linkText.invalidLink(), response.status === 410)
      if (!response.ok) throw new Error(linkText.couldNotLoad())
      const data = (await response.json()) as unknown
      const raw = asRecord(data)
      // Presentation additions may roll out independently. Identity, ordering and
      // expiration cannot be defaulted away when supplied but malformed.
      if (raw.config_version !== undefined && (!Number.isSafeInteger(raw.config_version) || Number(raw.config_version) < 0) ||
        raw.expires_at !== undefined && raw.expires_at !== null &&
          !(typeof raw.expires_at === 'string' && Number.isFinite(Date.parse(raw.expires_at)))) throw new Error(linkText.couldNotLoad())
      const config = completeConfig(data) ?? normalizeConfig(data)
      if (!config || config.token !== token) throw new Error(linkText.couldNotLoad())
      return config
    },
    /** The current endpoint is user-scoped, like the legacy display's church link. */
    async currentSession(userId, signal) {
      const response = await request(`${base}/s/${userId}/current.json?tz=${encodeURIComponent(timeZone())}`, {
        signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { Accept: 'application/json', 'X-Polling-Client': 'true' },
      })
      if (!response.ok) throw new Error(linkText.discoveryUnavailable())
      const data = asRecord(await response.json())
      return data.status === 'inactive' ? null : normalizeSession(data)
    },
  }
}
