import { createDisplayLinkApi, InvalidDisplayLinkError, type DisplayLinkConfig } from '@tarkman/reader'
import { t } from '../i18n'
import { readerText } from '../live/adapters'
import type { LiveSession } from '../live/contracts'

// Shared with apps/tv; see packages/tarkman-reader/src/display/link-api.ts.
export { InvalidDisplayLinkError }

const linkText = { invalidLink: () => t('display.invalidLink'), couldNotLoad: () => t('display.couldNotLoad'), discoveryUnavailable: () => t('display.discoveryUnavailable') }
const api = (base: string, request?: typeof fetch) => createDisplayLinkApi({ base, request, text: readerText, linkText })

/** Fetches a display-link configuration. The endpoint is unauthenticated; the token is its own capability. */
export function fetchDisplayLink(base: string, token: string, request: typeof fetch = fetch, signal?: AbortSignal): Promise<DisplayLinkConfig> {
  return api(base, request).link(token, signal)
}

/** The current endpoint is user-scoped, like the legacy display's church link. */
export function fetchCurrentDisplaySession(base: string, userId: number, signal: AbortSignal, request: typeof fetch = fetch): Promise<LiveSession | null> {
  return api(base, request).currentSession(userId, signal)
}
