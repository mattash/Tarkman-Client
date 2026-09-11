import { normalizeExplanations, normalizeParts, normalizeServices, normalizeSession } from './contracts'
import type { LiveExplanation, LivePart, LiveSession } from './contracts'
export interface ReaderApi {
  services(signal: AbortSignal): Promise<LiveSession[]>
  session(id: number, signal: AbortSignal): Promise<LiveSession>
  parts(id: number, signal: AbortSignal): Promise<LivePart[]>
  explanations(id: number, signal: AbortSignal): Promise<LiveExplanation[]>
}
export function createApi(base: string, request: typeof fetch = fetch): ReaderApi {
  async function get(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await request(`${base}${path}`, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'X-Polling-Client': 'true' } })
    if (!response.ok) throw new Error(response.status === 404 ? 'This service is no longer available.' : 'Could not load the service. Please retry.')
    return response.json()
  }
  return {
    services: async signal => normalizeServices(await get(`/services.json?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}`, signal)),
    session: async (id, signal) => normalizeSession(await get(`/s/${id}.json`, signal)),
    parts: async (id, signal) => normalizeParts(await get(`/s/${id}/parts.json`, signal)),
    explanations: async (id, signal) => normalizeExplanations(await get(`/s/${id}/explanations/current.json`, signal)),
  }
}
