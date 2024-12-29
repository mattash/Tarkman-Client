import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePusher } from '../hooks/usePusher'
import { usePartScroll } from '../hooks/usePartScroll'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'

interface SessionPartsParallelProps {
  sessionId: string
}

export function SessionPartsParallel({ sessionId }: SessionPartsParallelProps) {
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
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {data?.parts.map(({ part }) => (
        <div 
          className="grid grid-cols-2 gap-5 mb-5" 
          key={part.id}
          ref={(el) => {
            if (el) {
              partsRef.current[part.id] = el
            }
          }}
        >
          <div
            key={`en-${part.id}`}
            className="p-5 bg-gray-700 rounded-lg"
          >
            <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
            <div className="text-9xl">{part.translit}</div>
          </div>
          <div
            key={`tr-${part.id}`}
            className="p-5 bg-gray-700 rounded-lg"
          >
            <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
            <div className="text-9xl">{part.en}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
