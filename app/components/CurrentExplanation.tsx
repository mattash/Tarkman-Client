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
  const [previousExplanations, setPreviousExplanations] = React.useState<Explanation[]>([])

  React.useEffect(() => {
    if (pusherData) {
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
    }
  }, [pusherData, queryClient, sessionId])

  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
    enabled: true,
  })

  React.useEffect(() => {
    if (explanations?.length) {
      setPreviousExplanations(explanations)
    }
  }, [explanations])

  const displayExplanations = explanations ?? previousExplanations

  if (!displayExplanations?.length) {
    return <div>No explanation available</div>
  }

  return (
    <div className="max-w-3xl mx-auto relative">
      {isLoading && (
        <div className="absolute top-0 right-0 text-sm text-gray-500 animate-pulse">
          Updating...
        </div>
      )}
      <div className="prose-invert space-y-6">
        {displayExplanations.map((explanation) => (
          <div key={explanation.id}>
            <h1 className="text-2xl font-bold mb-4">{explanation.title}</h1>
            <ReactMarkdown>{explanation.description}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  )
} 