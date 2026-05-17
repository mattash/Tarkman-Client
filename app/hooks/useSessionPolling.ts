import { useQuery } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'

async function fetchCurrentSession(): Promise<SessionWrapper | null> {
  const churchId = import.meta.env.VITE_DEFAULT_CHURCH_ID || '2'
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${import.meta.env.VITE_DEFAULT_CHURCH_ID}/current.json?tz=${encodeURIComponent(tz)}`, {
    headers: {
      'X-Polling-Client': 'true',
    },
  })
  
  if (!response.ok) {
    throw new Error('Error fetching session')
  }
  
  const data = await response.json()
  
  // Check for inactive session response
  if ('status' in data && data.status === 'inactive') {
    return null
  }
  
  return data as SessionWrapper
}

export function useSessionPolling() {
  return useQuery<SessionWrapper | null>({
    queryKey: ['currentSession'],
    queryFn: fetchCurrentSession,
    retry: true,
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
    refetchInterval: (query) => {
      if (!query.state.data) {
        // When no active session, poll every 10 seconds
        return 10000
      }
      // When there is an active session, poll every 1 second
      return 1000
    },
    refetchOnWindowFocus: true,
    // Add some jitter to prevent thundering herd
    refetchIntervalInBackground: false,
    gcTime: 1000 * 60 * 5, // Keep cache for 5 minutes
  })
} 
