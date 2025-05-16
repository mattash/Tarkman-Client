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
  const subscriptionData = usePusher(`channel_${sessionId}`, 'part_change')
  const [previousExplanations, setPreviousExplanations] = React.useState<Explanation[]>([])

  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ['explanation', sessionId, subscriptionData?.part],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/current.json`)
      if (!response.ok) {
        throw new Error('Failed to fetch current explanation')
      }
      const data = await response.json()
      return data.explanations.map((item: { explanation: Explanation }) => item.explanation)
    },
    enabled: true,
  })

  React.useEffect(() => {
    if (explanations?.length) {
      setPreviousExplanations(explanations)
    }
  }, [explanations])

  const displayExplanations = explanations || previousExplanations

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
      <div className="space-y-6">
        {displayExplanations.map((explanation) => (
          <div key={explanation.id} className="prose-invert">
            <h1 className="text-2xl font-bold mb-4">{explanation.title}</h1>
            <ReactMarkdown>{explanation.description}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  )
} 