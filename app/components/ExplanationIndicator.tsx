import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useActionCable } from '@/hooks/useActionCable'
import { explanationQueryKeys, fetchCurrentExplanation } from '@/queries/explanationQueries'
import { Explanation } from '@/types/explanation'

interface ExplanationIndicatorProps {
  sessionId: string
  qrDurationMs?: number
  enabled?: boolean
}

export function ExplanationIndicator({ sessionId, qrDurationMs = 20000, enabled = true }: ExplanationIndicatorProps) {
  const queryClient = useQueryClient()
  const actionCableData = useActionCable(`channel_${sessionId}`, 'part_change')
  const [previousExplanations, setPreviousExplanations] = React.useState<Explanation[]>([])
  const [isHighlighting, setIsHighlighting] = React.useState(false)
  const [showQr, setShowQr] = React.useState(false)
  const lastSeenSignatureRef = React.useRef<string | null>(null)
  const qrTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (actionCableData) {
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
    }
  }, [actionCableData, queryClient, sessionId])

  const { data: explanations } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
    staleTime: 30 * 1000,
    enabled,
  })

  React.useEffect(() => {
    if (explanations?.length) {
      setPreviousExplanations(explanations)
    }
  }, [explanations])

  React.useEffect(() => {
    return () => {
      if (qrTimeoutRef.current !== null) {
        window.clearTimeout(qrTimeoutRef.current)
      }
    }
  }, [])

  const displayExplanations = explanations ?? previousExplanations

  React.useEffect(() => {
    if (!displayExplanations?.length) {
      return
    }

    const signature = displayExplanations
      .map((explanation) => {
        const timestamp = explanation.updated_at ?? explanation.created_at ?? ''
        return `${explanation.id}:${timestamp}`
      })
      .join('|')

    if (lastSeenSignatureRef.current === signature) {
      return
    }

    lastSeenSignatureRef.current = signature
    setIsHighlighting(true)
    setShowQr(true)

    if (qrTimeoutRef.current !== null) {
      window.clearTimeout(qrTimeoutRef.current)
    }

    qrTimeoutRef.current = window.setTimeout(() => {
      setShowQr(false)
      setIsHighlighting(false)
    }, qrDurationMs)
  }, [displayExplanations])

  const explanationUrl = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return `${window.location.origin}/sessions/${sessionId}/explanations`
  }, [sessionId])

  if (!enabled) return null

  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col items-end gap-6 pointer-events-none origin-top-right scale-[2]">
      <div
        className={`pointer-events-auto flex items-center gap-4 px-9 py-4 rounded-full bg-gray-900/90 text-white shadow-lg ring-2 ring-gray-700 transition-all ${
          isHighlighting ? 'ring-4 ring-purple-400/60 animate-pulse shadow-purple-400/40' : ''
        }`}
        aria-label="Explanation indicator"
      >
        <span className="text-base font-semibold uppercase tracking-wide text-gray-100">
          Explanation
        </span>
        <span
          className={`h-6 w-6 rounded-full ${
            isHighlighting ? 'bg-purple-300 shadow-[0_0_0_8px_rgba(168,85,247,0.35)]' : 'bg-gray-500'
          }`}
        />
      </div>

      {showQr && explanationUrl && (
        <div className="pointer-events-auto bg-gray-900/95 text-white rounded-lg shadow-2xl p-5 w-72 border border-purple-500/40 transition duration-300">
          <div className="text-sm font-semibold text-center mb-2">Scan & Learn</div>
          <div className="flex justify-center mb-3">
            <QRCodeSVG
              value={explanationUrl}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
          <div className="text-[11px] text-gray-300 text-center break-all">
            {explanationUrl}
          </div>
        </div>
      )}
    </div>
  )
}

