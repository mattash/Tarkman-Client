import { QueryClient } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'
import { PartsResponse } from '../types/part'
import { StatusUpdateRequest, StatusUpdateResponse } from '../types/status'
import { api } from '@/api'

export const sessionsKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionsKeys.all, 'list'] as const,
  session: (id: string) => [...sessionsKeys.all, 'session', id] as const,
  sessionParts: (id: string) => [...sessionsKeys.all, 'session', id, 'parts'] as const,
}

export const sessionMutationKeys = {
  controls: (id: string) => ['sessionControls', id] as const,
}

interface SessionsResponse {
  sessions?: SessionWrapper[]
}

export async function fetchSessions(tz: string): Promise<SessionWrapper[]> {
  try {
    const { data } = await api.get<SessionWrapper[]>('/services.json', {
      params: {
        tz
      }
    })
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error fetching sessions:', error)
    throw error
  }
}

export async function fetchSession(sessionId: string): Promise<SessionWrapper> {
  try {
    const { data } = await api.get<SessionWrapper>(`/s/${sessionId}.json`)
    return data
  } catch (error) {
    console.error(`Error fetching session ${sessionId}:`, error)
    throw error
  }
}

export async function fetchSessionParts(sessionId: string): Promise<PartsResponse> {
  let sessionData: SessionWrapper
  try {
    const { data } = await api.get<SessionWrapper>(`/s/${sessionId}.json`)
    sessionData = data
  } catch {
    throw new Error(`Failed to fetch session ${sessionId}`)
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

interface SessionPartResponse {
  status: string
  current_part_id: number
}

export async function setPart(sessionId: string, partId: number, transitionedAt?: string): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/set_part.json`, {
    part_id: partId,
    transitioned_at: transitionedAt
  })
  return data
}

export async function prevPart(sessionId: string, transitionedAt?: string): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/prev.json`, {
    transitioned_at: transitionedAt
  })
  return data
}

export async function nextPart(sessionId: string, transitionedAt?: string): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/next.json`, {
    transitioned_at: transitionedAt
  })
  return data
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
