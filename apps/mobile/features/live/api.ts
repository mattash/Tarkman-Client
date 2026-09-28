import { benchmarkHeaders, benchmarkMark, recoveryContext } from '../observability/latencyBenchmark'
import { normalizeExplanations, normalizeParts, normalizeServices, normalizeSession, normalizeState } from './contracts'
import type { LiveExplanation, LivePart, LiveSession, SessionState } from './contracts'
import { t } from '../i18n'
export interface ReaderApi {
  services(signal: AbortSignal): Promise<LiveSession[]>
  state?(id: number, signal: AbortSignal): Promise<SessionState | null>
  session(id: number, signal: AbortSignal): Promise<LiveSession>
  parts(id: number, signal: AbortSignal): Promise<LivePart[]>
  explanations(id: number, signal: AbortSignal): Promise<LiveExplanation[]>
}
const SESSION_NOT_FOUND = 'SessionNotFound'
function sessionNotFound(): Error { return Object.assign(new Error(t('common.serviceNoLongerAvailable')), { name: SESSION_NOT_FOUND }) }
export function isSessionNotFound(error: unknown): boolean { return error instanceof Error && error.name === SESSION_NOT_FOUND }
export function createApi(base: string, request: typeof fetch = fetch): ReaderApi {
  async function get(path: string, signal: AbortSignal, optional = false): Promise<unknown> {
    const trace = recoveryContext(signal)
    benchmarkMark('fetch.start', { path }, trace)
    const response = await request(`${base}${path}`, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'X-Polling-Client': 'true', ...benchmarkHeaders(trace) } })
    benchmarkMark('fetch.headers', { path, status: response.status }, trace)
    if (response.status === 404) {
      // Only the typed marker is authoritative deletion; a generic route 404 stays an ordinary failure.
      const body: unknown = await Promise.resolve().then(() => response.json()).catch(() => null)
      const code = body && typeof body === 'object' ? (body as Record<string, unknown>).code ?? (body as Record<string, unknown>).error : null
      if (code === 'session_not_found') throw sessionNotFound()
    }
    if (optional && (response.status === 404 || response.status === 405)) return null
    if (!response.ok) throw new Error(response.status === 404 ? t('common.serviceNoLongerAvailable') : t('errors.loadService'))
    const data: unknown = await response.json()
    benchmarkMark('fetch.parsed', { path }, trace)
    return data
  }
  return {
    services: async signal => normalizeServices(await get(`/services.json?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}`, signal)),
    state: async (id, signal) => {
      const data = await get(`/s/${id}/state.json`, signal, true)
      return data === null ? null : normalizeState(data)
    },
    session: async (id, signal) => normalizeSession(await get(`/s/${id}.json`, signal)),
    parts: async (id, signal) => normalizeParts(await get(`/s/${id}/parts.json`, signal)),
    explanations: async (id, signal) => normalizeExplanations(await get(`/s/${id}/explanations/current.json`, signal)),
  }
}
