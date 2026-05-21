import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { SessionWrapper } from '../types/session'
import { SessionCard } from './SessionCard'
import { fetchSessions, sessionsKeys } from '../queries/sessions'

export function SessionList() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { 
    data: sessions = [], 
    isLoading, 
    error 
  } = useQuery<SessionWrapper[]>({
    queryKey: sessionsKeys.list(),
    queryFn: () => fetchSessions(tz)
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <svg
          className="h-8 w-8 animate-spin text-tarkman-purple mb-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="Loading sessions"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium">Loading sessions…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-destructive">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm font-medium">Failed to load sessions</p>
        <p className="text-xs mt-1 opacity-70">Please try refreshing the page</p>
      </div>
    )
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-base font-semibold text-foreground">No services scheduled</p>
        <p className="text-sm mt-1 text-muted-foreground">Check back soon for upcoming services</p>
      </div>
    )
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