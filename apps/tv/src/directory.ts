/**
 * Client for the public church/display directory (backend mattash/Tarkman#457).
 *
 * Implements backend contract v1 (mattash/Tarkman#457, PR #459; docs/public-church-discovery.md in that
 * repo). Routes, DTO parsing and error mapping live only in this file. The app sees an opaque cursor;
 * here it is the next page number. See apps/tv/docs/church-display.md and the fixtures the tests use.
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

/** A reply that declares a schema other than v1 is not guessed at; an absent version is read as v1. */
function supportedSchema(raw: Record<string, unknown>): boolean {
  return raw.schema_version === undefined || raw.schema_version === 1
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
  if (!raw || !Array.isArray(raw.churches) || !supportedSchema(raw)) return null
  const pagination = raw.pagination === undefined ? {} : record(raw.pagination)
  if (!pagination) return null
  const next = pagination.next_page
  if (next !== undefined && next !== null && !(typeof next === 'number' && Number.isSafeInteger(next) && next > 0)) return null
  const seen = new Set<string>(), churches: DirectoryChurch[] = []
  for (const item of raw.churches) {
    const church = normalizeChurch(item)
    if (church && !seen.has(church.id)) { seen.add(church.id); churches.push(church) }
  }
  return { churches, nextCursor: typeof next === 'number' ? String(next) : null }
}
export function normalizeLinks(value: unknown): DirectoryLinks | null {
  const raw = record(value)
  if (raw && !supportedSchema(raw)) return null
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
    // 429 (rate limited) and 5xx are transient; the saved choice is kept and the caller retries.
    if (response.status === 404) throw new DirectoryError('not_found', 'not found')
    if (!response.ok) throw new DirectoryError('unavailable', `directory status ${response.status}`)
    try { return await response.json() } catch { throw new DirectoryError('unavailable', 'directory reply unreadable') }
  }
  return {
    async churches(query, cursor, signal) {
      const params = [`per_page=${pageSize}`]
      if (query.trim()) params.push(`q=${encodeURIComponent(Array.from(query.trim()).slice(0, 100).join(''))}`)
      if (cursor) params.push(`page=${encodeURIComponent(cursor)}`)
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
