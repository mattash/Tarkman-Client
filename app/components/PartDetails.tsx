import * as React from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Part } from '../types/part'
import { Explanation } from '../types/explanation'
import { Route } from '../routes/sessions.$id.part.$partId'
import DOMPurify from 'dompurify'
import { FastForwardButton } from './FastForwardButton'
import { fetchPart, partQueryKeys } from '@/queries/partQueries'

interface PartResponse {
  part: Part
}

interface PartDetailsProps {
  partId: number
}

const queryKeys = {
  part: (sessionId: string, partId: number) => ['part', sessionId, partId],
  explanation: (liturgyId: string, explanationId: string) => ['explanation', liturgyId, explanationId]
}

const queryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  retry: 2
}

export function PartDetails({ partId }: PartDetailsProps) {
  const { id: sessionId } = Route.useParams()

  // Fetch part details using refactored query
  const { data: partResponse, isLoading: isPartLoading, error: partError } = useQuery<PartResponse>({
    queryKey: partQueryKeys.detail(sessionId, partId),
    queryFn: () => fetchPart(sessionId, partId),
    ...queryConfig
  })

  const part = partResponse?.part

  // Fetch explanations using refactored query
  const explanationQueries = useQueries({
    queries: (part?.explanation_ids ?? []).map(explanationId => ({
      queryKey: queryKeys.explanation(sessionId, explanationId.toString()),
      queryFn: async () => {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/liturgies/${sessionId}/explanations/${explanationId}.json`)
        if (!response.ok) {
          throw new Error(`Failed to fetch explanation ${explanationId}`)
        }
        const data = await response.json()
        return data.explanation as Explanation
      },
      enabled: !!part,
      ...queryConfig
    }))
  })

  const isLoadingExplanations = explanationQueries.some(query => query.isLoading)
  const hasExplanationError = explanationQueries.some(query => query.error)
  const isLoading = isPartLoading || isLoadingExplanations
  const hasError = partError || hasExplanationError
  
  const explanations = explanationQueries
    .filter(query => query.data)
    .map(query => query.data!) as Explanation[]
  
  if (hasError) {
    return <div className="text-red-500">Error loading data</div>
  }

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>
  }

  if (!part) {
    return <div>Part not found</div>
  }

  return (
    <div className="space-y-6 bg-gray-800 text-white p-6 rounded-lg">
      {/* Role and Page */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold capitalize">{part.role}</h2>
          <FastForwardButton sessionId={sessionId} partId={partId} />
        </div>
        {part.page && (
          <span className="text-gray-400">Page {part.page}</span>
        )}
      </div>

      {/* Posture (if available) */}
      {part.posture && (
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold text-gray-400 mb-2">Posture</h3>
          <p className="whitespace-pre-wrap uppercase">{part.posture}</p>
        </div>
      )}

      {/* Translations */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Classical Armenian */}
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold text-gray-400 mb-2">Classical Armenian</h3>
          <p className="whitespace-pre-wrap">{part.grabar}</p>
        </div>

        {/* Transliteration */}
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold text-gray-400 mb-2">Transliteration</h3>
          <p className="whitespace-pre-wrap">{part.translit}</p>
        </div>

        {/* English */}
        <div className="bg-gray-700 p-4 rounded">
          <h3 className="font-semibold text-gray-400 mb-2">English</h3>
          <p className="whitespace-pre-wrap">{part.en}</p>
        </div>

        {/* Russian (if available) */}
        {part.ru && (
          <div className="bg-gray-700 p-4 rounded">
            <h3 className="font-semibold text-gray-400 mb-2">Russian</h3>
            <p className="whitespace-pre-wrap">{part.ru}</p>
          </div>
        )}

        {/* Eastern Armenian (if available) */}
        {part.hy_east && (
          <div className="bg-gray-700 p-4 rounded">
            <h3 className="font-semibold text-gray-400 mb-2">Eastern Armenian</h3>
            <p className="whitespace-pre-wrap">{part.hy_east}</p>
          </div>
        )}

        {/* Western Armenian (if available) */}
        {part.hy_west && (
          <div className="bg-gray-700 p-4 rounded">
            <h3 className="font-semibold text-gray-400 mb-2">Western Armenian</h3>
            <p className="whitespace-pre-wrap">{part.hy_west}</p>
          </div>
        )}
      </div>

      {/* Explanations */}
      {isLoadingExplanations ? (
        <div className="animate-pulse">Loading explanations...</div>
      ) : explanations?.length ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Explanations</h3>
          {explanations.map((explanation) => (
            <div key={explanation.id} className="bg-gray-700 p-4 rounded prose prose-invert max-w-none">
              <h4 className="text-lg font-semibold mb-2">{explanation.title}</h4>
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(explanation.description) }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
} 