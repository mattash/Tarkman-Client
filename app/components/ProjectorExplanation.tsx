import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { useActionCable } from '../hooks/useActionCable'
import { Explanation } from '../types/explanation'
import { explanationQueryKeys, fetchCurrentExplanation } from '../queries/explanationQueries'
import { TagBadge } from './TagBadge'
import { X } from 'lucide-react'

const LazyQRCodeSVG = React.lazy(() =>
  import('qrcode.react').then((module) => ({
    default: module.QRCodeSVG,
  })),
)

interface ProjectorExplanationProps {
  sessionId: string
  isVisible: boolean
  onClose: () => void
}

export function ProjectorExplanation({
  sessionId,
  isVisible,
  onClose
}: ProjectorExplanationProps) {
  const queryClient = useQueryClient()
  const actionCableData = useActionCable(`channel_${sessionId}`, 'part_change')
  const [previousExplanations, setPreviousExplanations] = React.useState<Explanation[]>([])

  React.useEffect(() => {
    if (actionCableData) {
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
    }
  }, [actionCableData, queryClient, sessionId])

  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
    enabled: isVisible, // Only fetch when visible
    staleTime: 30 * 1000, // 30 seconds
  })

  React.useEffect(() => {
    if (explanations?.length) {
      setPreviousExplanations(explanations)
    }
  }, [explanations])

  // Keyboard shortcut handler for ESC to close
  React.useEffect(() => {
    if (!isVisible) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isVisible, onClose])

  const displayExplanations = explanations ?? previousExplanations

  const explanationUrl = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    // Generate QR code URL - points to the explanations page for this session
    return `${window.location.origin}/sessions/${sessionId}/explanations`
  }, [sessionId])

  if (!isVisible || !displayExplanations?.length) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center overflow-y-auto">
      <div className="max-w-5xl w-full p-8 text-white relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 hover:bg-gray-800 rounded-full transition-colors z-10"
          aria-label="Hide explanation (press ESC to close)"
        >
          <X className="h-8 w-8" />
        </button>

        {isLoading && (
          <div className="absolute top-4 left-4 text-sm text-gray-400 animate-pulse">
            Updating...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
          {/* Main Content - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {displayExplanations.map((explanation) => (
              <div key={explanation.id} className="space-y-4">
                {/* Title */}
                <h1 className="text-4xl font-bold leading-tight">
                  {explanation.title}
                </h1>

                {/* Tags */}
                {explanation.tags && explanation.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {explanation.tags.map((tag, index) => (
                      <TagBadge key={index} tag={tag} variant="outline" />
                    ))}
                  </div>
                )}

                {/* Summary */}
                {explanation.summary && (
                  <div className="text-2xl italic text-blue-200 border-l-4 border-blue-400 pl-4 py-3">
                    {explanation.summary}
                  </div>
                )}

                {/* Description */}
                <div className="text-xl text-gray-200 prose prose-invert max-w-none leading-relaxed">
                  <ReactMarkdown>{explanation.description}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>

          {/* QR Code Sidebar - 1/3 width */}
          <div className="lg:col-span-1 flex flex-col items-center justify-start space-y-4 bg-white bg-opacity-10 rounded-lg p-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Read More</h2>
              <p className="text-sm text-gray-300 mb-4">Scan to view full explanation with citations on your phone</p>
            </div>

            <div className="bg-white p-4 rounded-lg">
              <React.Suspense fallback={null}>
                <LazyQRCodeSVG value={explanationUrl} size={200} level="M" includeMargin={true} />
              </React.Suspense>
            </div>

            <div className="text-xs text-gray-400 text-center mt-2">{explanationUrl}</div>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="mt-8 pt-4 border-t border-gray-700 text-sm text-gray-500 text-center">
          Press ESC to close
        </div>
      </div>
    </div>
  )
}
