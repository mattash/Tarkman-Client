import { DisplayLinkConfig } from '../types/displayLink'
import { api } from '../api'

export const displayLinkKeys = {
  all: ['displayLinks'] as const,
  detail: (token: string) => [...displayLinkKeys.all, token] as const,
}

export async function fetchDisplayLink(token: string): Promise<DisplayLinkConfig> {
  const { data } = await api.get<DisplayLinkConfig>(`/display_links/${token}`)
  return data
}
