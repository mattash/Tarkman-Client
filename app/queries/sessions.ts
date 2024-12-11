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

export async function fetchSessions(): Promise<SessionWrapper[]> {
  const response = await fetch('https://www.tarkman.app/services.json')
  return response.json()
}

export async function fetchSessionParts(sessionId: string): Promise<PartsResponse> {
  const [partsResponse, sessionResponse] = await Promise.all([
    fetch(`https://www.tarkman.app/s/${sessionId}/parts.json`),
    fetch(`https://www.tarkman.app/s/${sessionId}.json`)
  ])
  
  const partsData: PartsResponse = await partsResponse.json()
  const sessionData = await sessionResponse.json()
  
  return {
    parts: partsData.parts,
    sessionData
  }
} 