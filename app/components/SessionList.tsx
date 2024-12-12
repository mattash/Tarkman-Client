import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'
import { SessionCard } from './SessionCard'
import { fetchSessions, sessionsKeys } from '../queries/sessions'

export function SessionList() {
  const { 
    data: sessions = [], 
    isLoading, 
    error 
  } = useQuery<SessionWrapper[]>({
    queryKey: sessionsKeys.list(),
    queryFn: fetchSessions
  })

  if (isLoading) {
    return <div>Loading sessions...</div>
  }

  if (error) {
    return <div>Error loading sessions</div>
  }

  if (!Array.isArray(sessions)) {
    return <div>No services available</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Current Services</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((sessionWrapper) => (
          <SessionCard 
            key={sessionWrapper.session.id} 
            session={sessionWrapper.session} 
          />
        ))}
      </div>
    </div>
  )
} 