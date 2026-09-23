import { SessionWrapper } from '../types/session'
import { PartsResponse } from '../types/part'
import { StatusUpdateRequest, StatusUpdateResponse } from '../types/status'
import { api } from '@/api'
import axios from 'axios'

export const sessionsKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionsKeys.all, 'list'] as const,
  session: (id: string) => [...sessionsKeys.all, 'session', id] as const,
  sessionParts: (id: string) => [...sessionsKeys.all, 'sessionParts', id] as const,
  state: (id: string) => [...sessionsKeys.all, 'sessionState', id] as const,
}

export const sessionMutationKeys = {
  controls: (id: string) => ['sessionControls', id] as const,
}

export async function fetchSessions(tz: string): Promise<SessionWrapper[]> {
  const { data } = await api.get<SessionWrapper[]>('/services.json', {
    params: {
      tz
    }
  })
  return Array.isArray(data) ? data : []
}

export async function fetchSession(sessionId: string): Promise<SessionWrapper> {
  const { data } = await api.get<SessionWrapper>(`/s/${sessionId}.json`)
  return data
}

export async function fetchSessionParts(
  sessionId: string,
  knownSessionData?: SessionWrapper
): Promise<PartsResponse> {
  let sessionData = knownSessionData
  if (!sessionData) {
    try {
      const { data } = await api.get<SessionWrapper>(`/s/${sessionId}.json`)
      sessionData = data
    } catch {
      throw new Error(`Failed to fetch session ${sessionId}`)
    }
  }

  const liturgyId = sessionData?.session?.current_liturgy_id ?? sessionData?.session?.liturgy_id

  try {
    const { data: partsData } = await api.get<PartsResponse>(`/s/${sessionId}/parts.json`)
    return {
      parts: partsData.parts ?? [],
      sessionData,
    }
  } catch {
    // Fallback to liturgy parts if session parts are unavailable (e.g., multi-liturgy sessions)
  }

  if (liturgyId) {
    try {
      const { data: liturgyPartsData } = await api.get<PartsResponse>(`/liturgies/${liturgyId}/parts.json`)
      return {
        parts: liturgyPartsData.parts ?? [],
        sessionData,
      }
    } catch {
      // Throw the shared failure below.
    }
  }

  throw new Error(`Failed to load parts for session ${sessionId}`)
}

export interface SessionCommandResponse {
  status: string
  current_part_id: number
  revision?: number
  cursor?: { part_id: number; liturgy_part_id: number; liturgy_id: number; position: number } | null
  content_context?: string
  session_status?: string
  status_message?: string | null
  posture?: string | null
  date?: string | null
}

/**
 * The part this client believes the service is on. The server refuses the move with 409 when it
 * no longer matches, so a duplicated or replayed command cannot advance the service twice.
 */
function expectedPart(expectedPartId?: number | null, expectedRevision?: number) {
  return { ...(expectedPartId == null ? {} : { expected_part_id: expectedPartId }),
    ...(expectedRevision == null ? {} : { expected_revision: expectedRevision }) }
}

export async function setPart(sessionId: string, partId: number, transitionedAt?: string, expectedPartId?: number | null, expectedRevision?: number, liturgyPartId?: number): Promise<SessionCommandResponse> {
  const { data } = await api.post<SessionCommandResponse>(`/s/${sessionId}/set_part.json`, {
    part_id: partId,
    ...(liturgyPartId == null ? {} : { liturgy_part_id: liturgyPartId }),
    transitioned_at: transitionedAt,
    ...expectedPart(expectedPartId, expectedRevision)
  })
  return data
}

export async function prevPart(sessionId: string, transitionedAt?: string, expectedPartId?: number | null, expectedRevision?: number): Promise<SessionCommandResponse> {
  const { data } = await api.post<SessionCommandResponse>(`/s/${sessionId}/prev.json`, {
    transitioned_at: transitionedAt,
    ...expectedPart(expectedPartId, expectedRevision)
  })
  return data
}

export async function nextPart(sessionId: string, transitionedAt?: string, expectedPartId?: number | null, expectedRevision?: number): Promise<SessionCommandResponse> {
  const { data } = await api.post<SessionCommandResponse>(`/s/${sessionId}/next.json`, {
    transitioned_at: transitionedAt,
    ...expectedPart(expectedPartId, expectedRevision)
  })
  return data
}

export type ControlFailure =
  | { kind: 'stale'; currentPartId: number | null }
  | { kind: 'boundary'; direction: 'next' | 'previous' }
  | { kind: 'forbidden' }
  | { kind: 'unauthenticated' }
  | { kind: 'other' }

export function classifyControlFailure(error: unknown): ControlFailure {
  if (!axios.isAxiosError(error) || !error.response) return { kind: 'other' }
  const { status, data } = error.response
  if (status === 409) {
    const current = (data as { current_part_id?: unknown } | undefined)?.current_part_id
    return { kind: 'stale', currentPartId: typeof current === 'number' ? current : null }
  }
  if (status === 403) return { kind: 'forbidden' }
  if (status === 401) return { kind: 'unauthenticated' }
  // The move endpoints report a refusal past either end of the service with these bodies instead of
  // an error string (Rails next/prev at the boundary), and trying again can never succeed.
  const reported = (data as { status?: unknown } | undefined)?.status
  if (status === 422 && reported === 'Could not advance session') return { kind: 'boundary', direction: 'next' }
  if (status === 422 && reported === 'Could not back session') return { kind: 'boundary', direction: 'previous' }
  return { kind: 'other' }
}

export function controlFailureMessage(failure: ControlFailure, subject: 'position' | 'status'): string {
  switch (failure.kind) {
    case 'stale':
      return 'The service moved on somewhere else, so nothing changed here. The position shown has been refreshed.'
    case 'boundary':
      // A move past the end of the service is not a retryable failure; name the end it hit.
      return failure.direction === 'next'
        ? 'This is the last part. There is nothing after it.'
        : 'This is the first part. There is nothing before it.'
    case 'forbidden':
      return 'You do not have permission to control this service.'
    case 'unauthenticated':
      return 'Your sign-in has ended. Sign in again to continue.'
    default:
      return `The service ${subject} could not be updated. Please try again.`
  }
}

export async function updateSessionStatus(
  sessionId: string,
  request: StatusUpdateRequest
): Promise<StatusUpdateResponse> {
  const { data } = await api.patch<StatusUpdateResponse>(
    `/s/${sessionId}/update_status.json`,
    request
  )
  return data
} 
