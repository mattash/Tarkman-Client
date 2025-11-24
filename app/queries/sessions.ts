import { QueryClient } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'
import { PartsResponse } from '../types/part'
import { api } from '../api'

export const sessionsKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionsKeys.all, 'list'] as const,
  session: (id: string) => [...sessionsKeys.all, 'session', id] as const,
  sessionParts: (id: string) => [...sessionsKeys.all, 'session', id, 'parts'] as const,
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

export async function fetchSessionParts(sessionId: string): Promise<PartsResponse> {
  const sessionResponse = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}.json`)
  if (!sessionResponse.ok) {
    throw new Error(`Failed to fetch session ${sessionId}`)
  }

  const sessionData: SessionWrapper = await sessionResponse.json()
  const liturgyId = sessionData?.session?.current_liturgy_id ?? sessionData?.session?.liturgy_id

  const partsResponse = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/parts.json`)

  if (partsResponse.ok) {
    const partsData = await partsResponse.json()
    return {
      parts: partsData.parts ?? [],
      sessionData,
    }
  }

  // Fallback to liturgy parts if session parts are unavailable (e.g., multi-liturgy sessions)
  if (liturgyId) {
    const liturgyPartsResponse = await fetch(`${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/parts.json`)
    if (liturgyPartsResponse.ok) {
      const liturgyPartsData = await liturgyPartsResponse.json()
      return {
        parts: liturgyPartsData.parts ?? [],
        sessionData,
      }
    }
  }

  throw new Error(`Failed to load parts for session ${sessionId}`)
}

interface SessionPartResponse {
  status: string
  current_part_id: number
}

export async function setPart(sessionId: string, partId: number): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/set_part.json`, {
    part_id: partId
  })
  return data
}

export async function prevPart(sessionId: string): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/prev.json`)
  return data
}

export async function nextPart(sessionId: string): Promise<SessionPartResponse> {
  const { data } = await api.post<SessionPartResponse>(`/s/${sessionId}/next.json`)
  return data
} 
