import { Explanation } from '../types/explanation'

export const explanationQueryKeys = {
  all: (sessionId: string) => ['explanation', sessionId] as const,
  detail: (sessionId: string, explanationId: string) => ['explanation', sessionId, explanationId] as const,
  current: (sessionId: string) => ['explanation', sessionId, 'current'] as const,
}

export async function fetchExplanation(sessionId: string, explanationId: string): Promise<Explanation> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/${explanationId}.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch explanation ${explanationId}`)
  }
  return response.json()
}

export async function fetchCurrentExplanation(sessionId: string): Promise<Explanation | null> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/current.json`)
  if (!response.ok) {
    throw new Error('Failed to fetch current explanation')
  }
  const data: Explanation[] = await response.json()
  return data.length > 0 ? data[0] : null
} 