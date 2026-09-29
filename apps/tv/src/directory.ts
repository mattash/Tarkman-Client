/**
 * Client for the public church/display directory (backend mattash/Tarkman#457).
 *
 * The backend contract is not final: the routes and DTOs below are this client's PROPOSED v1 and
 * live only in this file, so adopting the backend's final names is a local change. See
 * apps/tv/docs/church-display.md for the full proposal and the fixtures the tests use.
 *
 * Everything is unauthenticated and read-only. A launch reference is a display-link token, which is
 * a public capability once published; it is never logged and only ever sent to the existing token read.
 */

export interface DirectoryChurch { id: string; name: string; locality: string | null }
export interface DirectoryChurchPage { churches: DirectoryChurch[]; nextCursor: string | null }
export interface DirectoryLink { id: string; title: string; token: string }
export interface DirectoryLinks { church: DirectoryChurch; links: DirectoryLink[] }

/** `not_found`: an unknown or unlisted church. `unavailable`: transport failure, 5xx or an unreadable reply. */
export type DirectoryFailure = 'not_found' | 'unavailable'
export class DirectoryError extends Error {
  constructor(readonly kind: DirectoryFailure, message: string) { super(message) }
}

export interface PublicDirectoryApi {
  churches(query: string, cursor: string | null, signal: AbortSignal): Promise<DirectoryChurchPage>
  links(churchId: string, signal: AbortSignal): Promise<DirectoryLinks>
}
export interface PublicDirectoryOptions { base: string; request?: typeof fetch; pageSize?: number }

const CHURCHES_PATH = '/public/churches'
const linksPath = (churchId: string) => `/public/churches/${encodeURIComponent(churchId)}/display_links`
const MAX_FIELD = 300

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
/** Opaque identifiers may arrive as strings or safe integers; they are always compared as strings. */
function identifier(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : value
  return typeof text === 'string' && text.length > 0 && text.length <= MAX_FIELD && text.trim() === text ? text : null
}
function label(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_FIELD ? value.trim() : null
}

/** Only the allowlisted fields survive, so a public reply can never smuggle management data into the app. */
export function normalizeChurch(value: unknown): DirectoryChurch | null {
  const raw = record(value)
  const id = identifier(raw?.id), name = label(raw?.name)
  if (!raw || !id || !name) return null
  const locality = raw.locality === undefined || raw.locality === null ? null : label(raw.locality)
  return { id, name, locality }
}
export function normalizeChurchPage(value: unknown): DirectoryChurchPage | null {
  const raw = record(value)
  if (!raw || !Array.isArray(raw.churches)) return null
  const next = raw.next_cursor
  if (next !== undefined && next !== null && identifier(next) === null) return null
  const seen = new Set<string>(), churches: DirectoryChurch[] = []
  for (const item of raw.churches) {
    const church = normalizeChurch(item)
    if (church && !seen.has(church.id)) { seen.add(church.id); churches.push(church) }
  }
  return { churches, nextCursor: typeof next === 'string' ? next : next === undefined || next === null ? null : String(next) }
}
export function normalizeLinks(value: unknown): DirectoryLinks | null {
  const raw = record(value)
  const church = normalizeChurch(raw?.church)
  if (!raw || !church || !Array.isArray(raw.display_links)) return null
  const seen = new Set<string>(), links: DirectoryLink[] = []
  for (const item of raw.display_links) {
    const entry = record(item), id = identifier(entry?.id), title = label(entry?.title), token = identifier(entry?.token)
    if (entry && id && title && token && !/\s/.test(token) && !seen.has(id)) { seen.add(id); links.push({ id, title, token }) }
  }
  return { church, links }
}

export function createPublicDirectoryApi({ base, request = fetch, pageSize = 20 }: PublicDirectoryOptions): PublicDirectoryApi {
  async function get(path: string, signal: AbortSignal): Promise<unknown> {
    let response: Response
    try {
      response = await request(`${base}${path}`, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
    } catch (error) {
      if (signal.aborted) throw error
      throw new DirectoryError('unavailable', 'directory request failed')
    }
    if (response.status === 404) throw new DirectoryError('not_found', 'not found')
    if (!response.ok) throw new DirectoryError('unavailable', `directory status ${response.status}`)
    try { return await response.json() } catch { throw new DirectoryError('unavailable', 'directory reply unreadable') }
  }
  return {
    async churches(query, cursor, signal) {
      const params = [`limit=${pageSize}`]
      if (query.trim()) params.push(`query=${encodeURIComponent(query.trim())}`)
      if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`)
      const page = normalizeChurchPage(await get(`${CHURCHES_PATH}?${params.join('&')}`, signal))
      if (!page) throw new DirectoryError('unavailable', 'directory reply malformed')
      return page
    },
    async links(churchId, signal) {
      const result = normalizeLinks(await get(linksPath(churchId), signal))
      if (!result) throw new DirectoryError('unavailable', 'directory reply malformed')
      return result
    },
  }
}
