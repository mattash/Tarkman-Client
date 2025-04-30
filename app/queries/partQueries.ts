import { Part } from '../types/part'

interface PartResponse {
  part: Part
}

export const partQueryKeys = {
  all: (sessionId: string) => ['part', sessionId] as const,
  detail: (sessionId: string, partId: number) => ['part', sessionId, partId] as const,
}

export async function fetchPart(sessionId: string, partId: number): Promise<PartResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/parts/${partId}.json`)
  if (!response.ok) {
    throw new Error('Failed to fetch part')
  }
  return response.json()
} 