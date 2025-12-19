import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { usePusher } from '../hooks/usePusher'
import { Explanation } from '../types/explanation'
import { explanationQueryKeys, fetchCurrentExplanation } from '../queries/explanationQueries'
import { TagBadge } from './TagBadge'
import { RatingDisplay } from './RatingDisplay'
import { CitationsList } from './CitationsList'

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
    <div className="max-w-4xl mx-auto relative">
      {isLoading && (
        <div className="absolute top-0 right-0 text-sm text-gray-500 animate-pulse">
          Updating...
        </div>
      )}
      <div className="prose-invert space-y-8">
        {displayExplanations.map((explanation) => (
          <div key={explanation.id} className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-3">{explanation.title}</h1>

              {/* Tags */}
              {explanation.tags && explanation.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {explanation.tags.map((tag, index) => (
                    <TagBadge key={index} tag={tag} />
                  ))}
                </div>
              )}

              {/* Rating */}
              {explanation.average_rating !== undefined && explanation.rating_count !== undefined && (
                <div className="mb-4">
                  <RatingDisplay
                    averageRating={explanation.average_rating}
                    ratingCount={explanation.rating_count}
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            {explanation.summary && (
              <div className="text-lg italic text-gray-300 border-l-4 border-blue-400 pl-4 py-2">
                {explanation.summary}
              </div>
            )}

            {/* Description */}
            <div className="text-gray-100 text-lg">
              <ReactMarkdown>{explanation.description}</ReactMarkdown>
            </div>

            {/* Citations */}
            {explanation.liturgy_id && (
              <CitationsList
                liturgyId={explanation.liturgy_id.toString()}
                explanationId={explanation.id.toString()}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 