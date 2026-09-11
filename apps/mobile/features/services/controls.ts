import type { KnownSessionStatus } from '@tarkman/core'
import { record } from '../live/contracts'
import type { AuthContextValue } from '../auth/AuthProvider'

export interface ServiceControls {
  next(id: number): Promise<void>
  previous(id: number): Promise<void>
  goToPart(id: number, partId: number): Promise<void>
  setStatus(id: number, status: KnownSessionStatus, message?: string): Promise<void>
}

/** Live control commands. Each call is sent once: nothing here retries or queues, so a stale move can never replay. */
export function createServiceControls(authorizedFetch: AuthContextValue['authorizedFetch']): ServiceControls {
  async function command(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<void> {
    const response = await authorizedFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (response.ok) return
    throw new Error(await failureMessage(response))
  }
  // The server records when the part actually changed, which keeps its timing analytics honest.
  const now = () => new Date().toISOString()
  return {
    next: id => command(`/s/${id}/next.json`, 'POST', { transitioned_at: now() }),
    previous: id => command(`/s/${id}/prev.json`, 'POST', { transitioned_at: now() }),
    goToPart: (id, partId) => command(`/s/${id}/set_part.json`, 'POST', { part_id: partId, transitioned_at: now() }),
    setStatus: (id, status, message) => command(`/s/${id}/update_status.json`, 'PATCH', { status, status_message: message }),
  }
}

async function failureMessage(response: Response): Promise<string> {
  if (response.status === 403) return 'You do not have permission to control this service.'
  if (response.status === 404) return 'This service is no longer available.'
  const data = record(await response.json().catch(() => null))
  const reported = typeof data.error === 'string' && data.error.length > 0 && data.error.length <= 200 ? data.error : undefined
  return reported ?? 'Could not update the service. Please try again.'
}
