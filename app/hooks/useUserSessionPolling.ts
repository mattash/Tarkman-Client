import { useQuery } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'

async function fetchUserCurrentSession(userId: string): Promise<SessionWrapper | null> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/s/${userId}/current.json`,
    { headers: { 'X-Polling-Client': 'true' } }
  )
  if (!response.ok) {
    throw new Error('Error fetching session')
  }
  const data = await response.json()
  if ('status' in data && data.status === 'inactive') {
    return null
  }
  return data as SessionWrapper
}

export function useUserSessionPolling(userId: string | null) {
  return useQuery<SessionWrapper | null>({
    queryKey: ['userCurrentSession', userId],
    queryFn: () => {
      if (!userId) return null
      return fetchUserCurrentSession(userId)
    },
    enabled: !!userId,
    retry: true,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
    refetchInterval: (query) => {
      if (!query.state.data) {
        return 10000
      }
      return 1000
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    gcTime: 1000 * 60 * 5,
  })
}
