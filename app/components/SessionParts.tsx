import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../contexts/LanguageContext'
import { useActionCable } from '../hooks/useActionCable'
import { usePartScroll } from '../hooks/usePartScroll'
import { LanguageSelector } from './LanguageSelector'
import PartCard from './PartCard'
import { fetchSession, fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'

interface SessionPartsProps {
  sessionId: string
}

export function SessionParts({ sessionId }: SessionPartsProps) {
  const { selectedLang, setSelectedLang } = useLanguage()
  const { partsRef, handlePartUpdated } = usePartScroll()
  const queryClient = useQueryClient()
  
  const subscriptionData = useActionCable(`channel_${sessionId}`, 'part_change')

  const { 
    data, 
    isLoading, 
    error 
  } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: async () => {
      const sessionData = await queryClient.fetchQuery({
        queryKey: sessionsKeys.session(sessionId),
        queryFn: () => fetchSession(sessionId),
        staleTime: 1000,
      })
      return fetchSessionParts(sessionId, sessionData)
    },
    staleTime: 0,
    refetchOnMount: true
  })

  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id) {
      handlePartUpdated({ part: data.sessionData.session.current_part_id })
    }
  }, [data, handlePartUpdated])

  React.useEffect(() => {
    if (subscriptionData?.part !== undefined) {
      handlePartUpdated({ part: subscriptionData.part })
    }
  }, [subscriptionData, handlePartUpdated])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>
  if (!data?.parts?.length) return <div>No parts available for this session.</div>

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
      <LanguageSelector 
        selectedLang={selectedLang} 
        onLanguageChange={setSelectedLang} 
      />
      <ul className="space-y-4">
        {(data?.parts ?? []).map(({ part }) => (
          <PartCard
            key={part.liturgy_part_id ?? part.id}
            ref={(el) => {
              if (el) {
                partsRef.current[part.id] = el
              }
            }}
            part={part}
            sessionId={sessionId}
          />
        ))}
      </ul>
    </div>
  )
} 
