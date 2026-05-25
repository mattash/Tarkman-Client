import {
  Explanation,
  ExplanationsResponse,
  ExplanationWrapper,
  Citation,
  CitationsResponse,
  RatingsResponse
} from '../types/explanation'
import { api } from '@/api'

export const explanationQueryKeys = {
  all: (sessionId: string) => ['explanation', sessionId] as const,
  detail: (sessionId: string, explanationId: string) => ['explanation', sessionId, explanationId] as const,
  current: (sessionId: string) => ['explanation', sessionId, 'current'] as const,
  upcoming: (sessionId: string) => ['explanation', sessionId, 'upcoming'] as const,
  liturgy: (liturgyId: string) => ['explanation', 'liturgy', liturgyId] as const,
  liturgyDetail: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId] as const,
  partExplanations: (liturgyId: string, partId: string) => ['explanation', 'liturgy', liturgyId, 'part', partId] as const,
  citations: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'citations'] as const,
  ratings: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'ratings'] as const,
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status
}

export async function fetchExplanation(sessionId: string, explanationId: string): Promise<Explanation> {
  try {
    const { data } = await api.get<ExplanationWrapper>(`/s/${sessionId}/explanations/${explanationId}.json`)
    return data.explanation
  } catch {
    throw new Error(`Failed to fetch explanation ${explanationId}`)
  }
}

export async function fetchCurrentExplanation(sessionId: string): Promise<Explanation[]> {
  try {
    const { data } = await api.get<ExplanationsResponse>(`/s/${sessionId}/explanations/current.json`)
    return data.explanations.map(wrapper => wrapper.explanation)
  } catch {
    throw new Error('Failed to fetch current explanation')
  }
}

export async function fetchUpcomingExplanations(sessionId: string, lookahead: number = 3): Promise<Explanation[]> {
  try {
    const { data } = await api.get<ExplanationsResponse>(`/s/${sessionId}/explanations/upcoming.json`, {
      params: { lookahead },
    })
    return data.explanations.map(wrapper => wrapper.explanation)
  } catch (error) {
    // Return empty array for 404s instead of throwing
    if (getErrorStatus(error) === 404) {
      return []
    }
    throw new Error('Failed to fetch upcoming explanations')
  }
}

export async function fetchLiturgyExplanations(liturgyId: string): Promise<Explanation[]> {
  try {
    const { data } = await api.get<ExplanationsResponse>(`/liturgies/${liturgyId}/explanations.json`)
    return data.explanations.map(wrapper => wrapper.explanation)
  } catch {
    throw new Error('Failed to fetch liturgy explanations')
  }
}

export async function fetchLiturgyExplanation(liturgyId: string, explanationId: string): Promise<Explanation> {
  try {
    const { data } = await api.get<ExplanationWrapper>(`/liturgies/${liturgyId}/explanations/${explanationId}.json`)
    return data.explanation
  } catch {
    throw new Error(`Failed to fetch liturgy explanation ${explanationId}`)
  }
}

export async function fetchPartExplanations(liturgyId: string, partId: string): Promise<Explanation[]> {
  try {
    const { data } = await api.get<ExplanationsResponse | Explanation[]>(`/liturgies/${liturgyId}/parts/${partId}/explanations.json`)

    // Handle both response structures
    if ('explanations' in data) {
      return data.explanations.map((wrapper: ExplanationWrapper) => wrapper.explanation)
    } else if (Array.isArray(data)) {
      return data
    } else {
      return []
    }
  } catch (error) {
    // Return empty array for 404s instead of throwing
    if (getErrorStatus(error) === 404) {
      return []
    }
    throw new Error(`Failed to fetch part explanations for part ${partId}`)
  }
}

export async function fetchExplanationCitations(
  liturgyId: string,
  explanationId: string
): Promise<Citation[]> {
  try {
    const { data } = await api.get<CitationsResponse>(
      `/liturgies/${liturgyId}/explanations/${explanationId}/citations.json`
    )
    return data.citations || []
  } catch (error) {
    // Return empty array for 404s instead of throwing
    if (getErrorStatus(error) === 404) {
      return []
    }
    throw new Error('Failed to fetch citations')
  }
}

export async function fetchExplanationRatings(
  liturgyId: string,
  explanationId: string
): Promise<RatingsResponse> {
  try {
    const { data } = await api.get<RatingsResponse>(
      `/liturgies/${liturgyId}/explanations/${explanationId}/ratings.json`
    )
    return data
  } catch (error) {
    // Return zero ratings for 404s instead of throwing
    if (getErrorStatus(error) === 404) {
      return { average_rating: 0, rating_count: 0, ratings: [] }
    }
    throw new Error('Failed to fetch ratings')
  }
} 
