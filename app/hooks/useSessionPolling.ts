import { useQuery } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'

interface ErrorResponse {
  error: string
}

async function fetchCurrentSession(): Promise<SessionWrapper | null> {
  const response = await fetch('https://www.tarkman.app/s/2/current.json')
  
  if (response.status === 404) {
    // Return null to indicate no active session instead of throwing
    return null
  }
  
  if (!response.ok) {
    throw new Error('Error fetching session')
  }
  
  return response.json()
}

export function useSessionPolling() {
  return useQuery<SessionWrapper | null>({
    queryKey: ['currentSession'],
    queryFn: fetchCurrentSession,
    retry: true,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
    refetchInterval: (query) => {
      if (!query.state.data) {
        // When no active session, poll every 5 seconds
        return 5000
      }
      return 10000
    },
    refetchOnWindowFocus: true,
    // Add some jitter to prevent thundering herd
    refetchIntervalInBackground: false,
    gcTime: 1000 * 60 * 5, // Keep cache for 5 minutes
  })
} 