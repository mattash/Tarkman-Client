import { QueryClient } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'
import { Part, SessionPartData, PartsResponse } from '../types/part'
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
  const [partsResponse, sessionResponse] = await Promise.all([
    fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/parts.json`),
    fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}.json`)
  ])
  
  const partsData: PartsResponse = await partsResponse.json()
  const sessionData = await sessionResponse.json()
  
  return {
    parts: partsData.parts,
    sessionData
  }
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