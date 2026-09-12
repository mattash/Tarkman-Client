import type { KnownSessionStatus } from '@tarkman/core'
import { record } from '../live/contracts'
import type { AuthContextValue } from '../auth/AuthProvider'

export interface ServiceControls {
  next(id: number, expectedPartId: number | null): Promise<void>
  previous(id: number, expectedPartId: number | null): Promise<void>
  goToPart(id: number, partId: number, expectedPartId: number | null): Promise<void>
  setStatus(id: number, status: KnownSessionStatus, message?: string): Promise<void>
}

const STALE = 'StalePartError'
/** The service moved on before this command arrived, so the screen should resync instead of moving again. */
export function isStalePart(error: unknown): boolean {
  return error instanceof Error && error.name === STALE
}

/** Live control commands. Each call is sent once: nothing here retries or queues, so a stale move can never replay. */
export function createServiceControls(authorizedFetch: AuthContextValue['authorizedFetch']): ServiceControls {
  async function command(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<void> {
    const response = await authorizedFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (response.ok) return
    const failure = new Error(await failureMessage(response))
    if (response.status === 409) failure.name = STALE
    throw failure
  }
  // The server records when the part actually changed, which keeps its timing analytics honest.
  const now = () => new Date().toISOString()
  // Sending the part this device is showing lets the server refuse a move that is already out of date.
  const move = (expectedPartId: number | null) => expectedPartId === null ? {} : { expected_part_id: expectedPartId }
  return {
    next: (id, expectedPartId) => command(`/s/${id}/next.json`, 'POST', { transitioned_at: now(), ...move(expectedPartId) }),
    previous: (id, expectedPartId) => command(`/s/${id}/prev.json`, 'POST', { transitioned_at: now(), ...move(expectedPartId) }),
    goToPart: (id, partId, expectedPartId) => command(`/s/${id}/set_part.json`, 'POST', { part_id: partId, transitioned_at: now(), ...move(expectedPartId) }),
    setStatus: (id, status, message) => command(`/s/${id}/update_status.json`, 'PATCH', { status, status_message: message }),
  }
}

async function failureMessage(response: Response): Promise<string> {
  if (response.status === 403) return 'You do not have permission to control this service.'
  if (response.status === 404) return 'This service is no longer available.'
  if (response.status === 409) return 'The service already moved on, so nothing was changed. Check the current part and try again.'
  const data = record(await response.json().catch(() => null))
  const reported = typeof data.error === 'string' && data.error.length > 0 && data.error.length <= 200 ? data.error : undefined
  return reported ?? 'Could not update the service. Please try again.'
}
