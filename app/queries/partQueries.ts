import { Part } from '../types/part'
import { api } from '@/api'

interface PartResponse {
  part: Part
}

export const partQueryKeys = {
  all: (sessionId: string) => ['part', sessionId] as const,
  detail: (sessionId: string, partId: number) => ['part', sessionId, partId] as const,
}

export async function fetchPart(sessionId: string, partId: number): Promise<PartResponse> {
  const { data } = await api.get<PartResponse>(`/s/${sessionId}/parts/${partId}.json`)
  return data
} 
