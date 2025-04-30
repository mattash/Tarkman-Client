import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { usePusher } from '../hooks/usePusher'

interface Explanation {
  id: number
  title: string
  description: string
  created_at: string
  updated_at: string
  row_order: number
}

interface CurrentExplanationProps {
  sessionId: string
}

export function CurrentExplanation({ sessionId }: CurrentExplanationProps) {
  const subscriptionData = usePusher(`channel_${sessionId}`, 'part_change')
  const [previousExplanation, setPreviousExplanation] = React.useState<Explanation | null>(null)

  const { data: explanation, isLoading } = useQuery<Explanation>({
    queryKey: ['explanation', sessionId, subscriptionData?.part],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/s/${sessionId}/explanations/current.json`)
      if (!response.ok) {
        throw new Error('Failed to fetch current explanation')
      }
      const data = await response.json()
      return data
    },
    enabled: true,
  })

  React.useEffect(() => {
    if (explanation) {
      setPreviousExplanation(explanation)
    }
  }, [explanation])

  const displayExplanation = explanation || previousExplanation

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