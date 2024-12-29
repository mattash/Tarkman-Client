import * as React from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Part } from '../types/part'
import { Route } from '../routes/sessions.$id.part.$partId'
import DOMPurify from 'dompurify'
import { FastForwardButton } from './FastForwardButton'

interface Explanation {
  id: number
  title: string
  description: string
}

interface ExplanationResponse {
  explanation: Explanation
}

interface PartResponse {
  part: Part
}

interface PartDetailsProps {
  partId: number
}

export function PartDetails({ partId }: PartDetailsProps) {
  const { id: sessionId } = Route.useParams()

  // Fetch part details
  const { data: partResponse, isLoading: isPartLoading } = useQuery<PartResponse>({
    queryKey: ['part', sessionId, partId],
    queryFn: async () => {
      const response = await fetch(`https://www.tarkman.app/s/${sessionId}/parts/${partId}.json`)
      const data = await response.json()
      return data
    }
  })

  const part = partResponse?.part

  // Fetch explanations for each explanation_id
  const explanationQueries = useQueries({
    queries: (part?.explanation_ids ?? []).map(explanationId => ({
      queryKey: ['explanation', sessionId, explanationId],
      queryFn: async () => {
        const response = await fetch(`https://www.tarkman.app/s/${sessionId}/explanations/${explanationId}.json`)
        const data = await response.json()
        return data as ExplanationResponse
      }
    }))
  })

  const isLoadingExplanations = explanationQueries.some(query => query.isLoading)
  const explanations = explanationQueries
    .filter(query => query.data?.explanation)
    .map(query => query.data.explanation)

  if (isPartLoading) {
    return <div className="animate-pulse">Loading part details...</div>
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