import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { usePusher } from '../hooks/usePusher'
import { Explanation } from '../types/explanation'
import { explanationQueryKeys, fetchCurrentExplanation } from '../queries/explanationQueries'

interface CurrentExplanationProps {
  sessionId: string
}

export function CurrentExplanation({ sessionId }: CurrentExplanationProps) {
  const queryClient = useQueryClient()
  const pusherData = usePusher(`channel_${sessionId}`, 'part_change')
  const [previousExplanation, setPreviousExplanation] = React.useState<Explanation | null>(null)

  React.useEffect(() => {
    if (pusherData) {
      console.log('Pusher received part_change, invalidating current explanation query', pusherData)
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
    }
  }, [pusherData, queryClient, sessionId])

  const { data: explanation, isLoading } = useQuery<Explanation | null>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
    enabled: true,
  })

  React.useEffect(() => {
    if (explanation) {
      setPreviousExplanation(explanation)
    }
  }, [explanation])

  const displayExplanation = explanation ?? previousExplanation

  if (!displayExplanation) {
    return <div>No explanation available</div>
  }

  return (
    <div className="max-w-3xl mx-auto relative">
      {isLoading && (
        <div className="absolute top-0 right-0 text-sm text-gray-500 animate-pulse">
          Updating...
        </div>
      )}
      <div className="prose-invert">
        <h1 className="text-2xl font-bold mb-4">{displayExplanation.title}</h1>
        <ReactMarkdown>{displayExplanation.description}</ReactMarkdown>
      </div>
    </div>
  )
} 