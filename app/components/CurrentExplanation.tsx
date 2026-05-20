import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { useActionCable } from '../hooks/useActionCable'
import { Explanation } from '../types/explanation'
import { explanationQueryKeys, fetchCurrentExplanation, fetchUpcomingExplanations } from '../queries/explanationQueries'
import { TagBadge } from './TagBadge'
import { RatingDisplay } from './RatingDisplay'
import { CitationsList } from './CitationsList'
import { ChevronRight, Clock } from 'lucide-react'

interface CurrentExplanationProps {
  sessionId: string
}

export function CurrentExplanation({ sessionId }: CurrentExplanationProps) {
  const queryClient = useQueryClient()
  const actionCableData = useActionCable(`channel_${sessionId}`, 'part_change')
  const [previousExplanations, setPreviousExplanations] = React.useState<Explanation[]>([])

  React.useEffect(() => {
    if (actionCableData) {
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.upcoming(sessionId) })
    }
  }, [actionCableData, queryClient, sessionId])

  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
    enabled: true,
  })

  const { data: upcomingExplanations } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.upcoming(sessionId),
    queryFn: () => fetchUpcomingExplanations(sessionId, 3),
    enabled: true,
  })

  React.useEffect(() => {
    if (explanations?.length) {
      setPreviousExplanations(explanations)
    }
  }, [explanations])

  const displayExplanations = explanations ?? previousExplanations
  const hasCurrentExplanations = explanations && explanations.length > 0
  const hasUpcomingExplanations = upcomingExplanations && upcomingExplanations.length > 0
  const hasPreviousExplanations = !hasCurrentExplanations && previousExplanations.length > 0

  return (
    <div className="max-w-4xl mx-auto relative">
      {isLoading && (
        <div className="absolute top-0 right-0 text-sm text-gray-500 animate-pulse">
          Updating...
        </div>
      )}

      {/* No active explanations - show helpful message and upcoming */}
      {!hasCurrentExplanations && !isLoading && (
        <div className="space-y-8">
          <div className="text-center py-12 space-y-4">
            <div className="text-gray-400 text-xl">
              {hasPreviousExplanations ? (
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-gray-300">Previous Explanation</p>
                  <p className="text-base">The service has moved to a new section</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-gray-300">No Active Explanation</p>
                  <p className="text-base">Tarkman does not currently have an active explanation for this part of the service. Check back next week for an update.</p>
                </div>
              )}
            </div>
          </div>

          {/* Show previous explanation if available */}
          {hasPreviousExplanations && (
            <div className="opacity-60 space-y-8">
              {previousExplanations.map((explanation) => (
                <div key={explanation.id} className="space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-3">{explanation.title}</h1>

                    {explanation.tags && explanation.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {explanation.tags.map((tag, index) => (
                          <TagBadge key={index} tag={tag} />
                        ))}
                      </div>
                    )}

                    {explanation.average_rating !== undefined && explanation.rating_count !== undefined && (
                      <div className="mb-4">
                        <RatingDisplay
                          averageRating={explanation.average_rating}
                          ratingCount={explanation.rating_count}
                        />
                      </div>
                    )}
                  </div>

                  {explanation.summary && (
                    <div className="text-lg italic text-gray-300 border-l-4 border-blue-400 pl-4 py-2">
                      {explanation.summary}
                    </div>
                  )}

                  <div className="text-gray-100 text-lg">
                    <ReactMarkdown>{explanation.description}</ReactMarkdown>
                  </div>

                  {explanation.liturgy_id && (
                    <CitationsList
                      liturgyId={explanation.liturgy_id.toString()}
                      explanationId={explanation.id.toString()}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current explanations */}
      {hasCurrentExplanations && (
        <div className="prose-invert space-y-8">
          {explanations!.map((explanation) => (
            <div key={explanation.id} className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-3">{explanation.title}</h1>

                {explanation.tags && explanation.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {explanation.tags.map((tag, index) => (
                      <TagBadge key={index} tag={tag} />
                    ))}
                  </div>
                )}

                {explanation.average_rating !== undefined && explanation.rating_count !== undefined && (
                  <div className="mb-4">
                    <RatingDisplay
                      averageRating={explanation.average_rating}
                      ratingCount={explanation.rating_count}
                    />
                  </div>
                )}
              </div>

              {explanation.summary && (
                <div className="text-lg italic text-gray-300 border-l-4 border-blue-400 pl-4 py-2">
                  {explanation.summary}
                </div>
              )}

              <div className="text-gray-100 text-lg">
                <ReactMarkdown>{explanation.description}</ReactMarkdown>
              </div>

              {explanation.liturgy_id && (
                <CitationsList
                  liturgyId={explanation.liturgy_id.toString()}
                  explanationId={explanation.id.toString()}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upcoming explanations preview */}
      {hasUpcomingExplanations && (
        <div className="mt-12 border-t border-gray-700 pt-8">
          <div className="flex items-center gap-2 text-gray-400 mb-6">
            <Clock className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Coming Up</h2>
          </div>
          <div className="space-y-6">
            {upcomingExplanations!.map((explanation, index) => (
              <div
                key={explanation.id}
                className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tarkman-purple-light/20 flex items-center justify-center text-sm font-semibold text-tarkman-purple-light">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-200 mb-1">
                      {explanation.title}
                    </h3>

                    {explanation.tags && explanation.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {explanation.tags.map((tag, tagIndex) => (
                          <TagBadge key={tagIndex} tag={tag} />
                        ))}
                      </div>
                    )}

                    {explanation.summary && (
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {explanation.summary}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 