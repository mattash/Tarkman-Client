import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../contexts/LanguageContext'
import { usePusher } from '../hooks/usePusher'
import { usePartScroll } from '../hooks/usePartScroll'
import { LanguageSelector } from './LanguageSelector'
import PartCard from './PartCard'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import { SessionData } from '../types/session'

interface SessionPartsProps {
  sessionId: string
}

export function SessionParts({ sessionId }: SessionPartsProps) {
  const { selectedLang, setSelectedLang } = useLanguage()
  const { partsRef, handlePartUpdated } = usePartScroll()
  
  const subscriptionData = usePusher(`channel_${sessionId}`, 'part_change')

  const { 
    data, 
    isLoading, 
    error 
  } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: () => fetchSessionParts(sessionId),
    staleTime: 0,
    refetchOnMount: true
  })

  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id) {
      handlePartUpdated({ part: data.sessionData.session.current_part_id })
    }
  }, [data, handlePartUpdated])

  React.useEffect(() => {
    if (subscriptionData) {
      handlePartUpdated(subscriptionData)
    }
  }, [subscriptionData, handlePartUpdated])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
      <LanguageSelector 
        selectedLang={selectedLang} 
        onLanguageChange={setSelectedLang} 
      />
      <ul className="space-y-4">
        {data?.parts.map(({ part }) => {
          return (
            <PartCard
              key={part.id}
              ref={(el) => {
                if (el) {
                  partsRef.current[part.id] = el
                }
              }}
              part={part}
            />
          )
        })}
      </ul>
    </div>
  )
} 