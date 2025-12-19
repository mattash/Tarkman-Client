import {
  Explanation,
  ExplanationsResponse,
  ExplanationWrapper,
  Citation,
  CitationsResponse,
  RatingsResponse
} from '../types/explanation'
import { api } from '../api'

export const explanationQueryKeys = {
  all: (sessionId: string) => ['explanation', sessionId] as const,
  detail: (sessionId: string, explanationId: string) => ['explanation', sessionId, explanationId] as const,
  current: (sessionId: string) => ['explanation', sessionId, 'current'] as const,
  liturgy: (liturgyId: string) => ['explanation', 'liturgy', liturgyId] as const,
  liturgyDetail: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId] as const,
  partExplanations: (liturgyId: string, partId: string) => ['explanation', 'liturgy', liturgyId, 'part', partId] as const,
  citations: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'citations'] as const,
  ratings: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'ratings'] as const,
}

export async function fetchExplanation(sessionId: string, explanationId: string): Promise<Explanation> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/${explanationId}.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch explanation ${explanationId}`)
  }
  const data: ExplanationWrapper = await response.json()
  return data.explanation
}

export async function fetchCurrentExplanation(sessionId: string): Promise<Explanation[]> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/current.json`)
  if (!response.ok) {
    throw new Error('Failed to fetch current explanation')
  }
  const data: ExplanationsResponse = await response.json()
  return data.explanations.map(wrapper => wrapper.explanation)
}

export async function fetchLiturgyExplanations(liturgyId: string): Promise<Explanation[]> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/explanations.json`)
  if (!response.ok) {
    throw new Error('Failed to fetch liturgy explanations')
  }
  const data: ExplanationsResponse = await response.json()
  return data.explanations.map(wrapper => wrapper.explanation)
}

export async function fetchLiturgyExplanation(liturgyId: string, explanationId: string): Promise<Explanation> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/explanations/${explanationId}.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch liturgy explanation ${explanationId}`)
  }
  const data: ExplanationWrapper = await response.json()
  return data.explanation
}

export async function fetchPartExplanations(liturgyId: string, partId: string): Promise<Explanation[]> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/parts/${partId}/explanations.json`)

  // Return empty array for 404s instead of throwing
  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch part explanations for part ${partId}`)
  }

  const data = await response.json()

  // Handle both response structures
  if (data.explanations) {
    return data.explanations.map((wrapper: ExplanationWrapper) => wrapper.explanation)
  } else if (Array.isArray(data)) {
    return data
  } else {
    return []
  }
}

export async function fetchExplanationCitations(
  liturgyId: string,
  explanationId: string
): Promise<Citation[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/explanations/${explanationId}/citations.json`
  )

  // Return empty array for 404s instead of throwing
  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    throw new Error('Failed to fetch citations')
  }

  const data: CitationsResponse = await response.json()
  return data.citations || []
}

export async function fetchExplanationRatings(
  liturgyId: string,
  explanationId: string
): Promise<RatingsResponse> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/liturgies/${liturgyId}/explanations/${explanationId}/ratings.json`
  )

  // Return zero ratings for 404s instead of throwing
  if (response.status === 404) {
    return { average_rating: 0, rating_count: 0, ratings: [] }
  }

  if (!response.ok) {
    throw new Error('Failed to fetch ratings')
  }

  return response.json()
} 