import { benchmarkHeaders, benchmarkMark, recoveryContext } from '../observability/latencyBenchmark'
import { normalizeExplanations, normalizeParts, normalizeServices, normalizeSession } from './contracts'
import type { LiveExplanation, LivePart, LiveSession } from './contracts'
import { t } from '../i18n'
export interface ReaderApi {
  services(signal: AbortSignal): Promise<LiveSession[]>
  session(id: number, signal: AbortSignal): Promise<LiveSession>
  parts(id: number, signal: AbortSignal): Promise<LivePart[]>
  explanations(id: number, signal: AbortSignal): Promise<LiveExplanation[]>
}
export function createApi(base: string, request: typeof fetch = fetch): ReaderApi {
  async function get(path: string, signal: AbortSignal): Promise<unknown> {
    const trace = recoveryContext(signal)
    benchmarkMark('fetch.start', { path }, trace)
    const response = await request(`${base}${path}`, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'X-Polling-Client': 'true', ...benchmarkHeaders(trace) } })
    benchmarkMark('fetch.headers', { path, status: response.status }, trace)
    if (!response.ok) throw new Error(response.status === 404 ? t('common.serviceNoLongerAvailable') : t('errors.loadService'))
    const data: unknown = await response.json()
    benchmarkMark('fetch.parsed', { path }, trace)
    return data
  }
  return {
    services: async signal => normalizeServices(await get(`/services.json?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}`, signal)),
    session: async (id, signal) => normalizeSession(await get(`/s/${id}.json`, signal)),
    parts: async (id, signal) => normalizeParts(await get(`/s/${id}/parts.json`, signal)),
    explanations: async (id, signal) => normalizeExplanations(await get(`/s/${id}/explanations/current.json`, signal)),
  }
}
