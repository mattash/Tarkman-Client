import type { AuthContextValue } from '../../auth/AuthProvider'

export interface PresenceSnapshot {
  sessionId: number
  count: number
  others: number
  selfPresent: boolean
  acceptedSequence: number | null
  interval: number
  ttl: number
}

export function parsePresence(value: unknown, sessionId: number): PresenceSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid presence response') // i18n-ignore: internal protocol error, never shown to readers
  const data = value as Record<string, unknown>
  const safe = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0
  const sequence = data.accepted_sequence
  const self = data.self_present
  const expires = data.self_expires_at
  const time = (n: unknown) => typeof n === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(n) && Number.isFinite(Date.parse(n))
  const interval = data.heartbeat_interval_seconds
  const ttl = data.lease_ttl_seconds
  // Database snapshot and JSON timestamps can straddle a statement/serialization boundary;
  // two seconds is generous for that skew, not an extension of the advertised lease.
  const leaseToleranceMs = 2000
  if (data.session_id !== sessionId || data.reporting_scope !== 'participating_clients' || !safe(data.controller_count) || !safe(data.other_controller_count) ||
    typeof self !== 'boolean' || (sequence !== null && (!safe(sequence) || sequence === 0)) ||
    !time(data.server_time) || (expires !== null && !time(expires)) ||
    !Number.isSafeInteger(interval) || (interval as number) < 1 || (interval as number) > 60 ||
    !Number.isSafeInteger(ttl) || (ttl as number) < (interval as number) || (ttl as number) > 300 ||
    (self ? data.controller_count !== (data.other_controller_count as number) + 1 || sequence === null || expires === null ||
      Date.parse(expires as string) <= Date.parse(data.server_time as string) ||
      Date.parse(expires as string) - Date.parse(data.server_time as string) > (ttl as number) * 1000 + leaseToleranceMs
      : data.controller_count !== data.other_controller_count || expires !== null)) {
    throw new Error('Invalid presence response') // i18n-ignore: internal protocol error, never shown to readers
  }
  return { sessionId, count: data.controller_count as number, others: data.other_controller_count as number,
    selfPresent: self, acceptedSequence: sequence as number | null, interval: interval as number, ttl: ttl as number }
}

export async function putPresence(fetcher: AuthContextValue['authorizedFetch'], sessionId: number, uuid: string, sequence: number, active: boolean, signal: AbortSignal): Promise<PresenceSnapshot> {
  const response = await fetcher(`/s/${sessionId}/controller_presence/${uuid}.json`, {
    method: 'PUT', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sequence, active }),
  })
  if (!response.ok) throw Object.assign(new Error('Presence unavailable'), { status: response.status }) // i18n-ignore: internal protocol error, never shown to readers
  return parsePresence(await response.json(), sessionId)
}
