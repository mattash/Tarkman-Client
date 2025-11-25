import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePusher } from '../hooks/usePusher'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import ReactMarkdown from 'react-markdown'

interface SessionPartsParallelProps {
  sessionId: string
}

export function SessionPartsParallel({ sessionId }: SessionPartsParallelProps) {
  const partsRef = React.useRef<Record<string, HTMLElement>>({})
  const scrollAnimationRef = React.useRef<number | null>(null)
  const scrollTimeoutRef = React.useRef<number | null>(null)
  const [currentPartId, setCurrentPartId] = React.useState<string | null>(null)
  const subscriptionData = usePusher(`channel_${sessionId}`, 'part_change')

  const smoothScrollToPart = React.useCallback((element: HTMLElement) => {
    // Retrieve the server-provided estimate for how long it should take to
    // "consume" this part (in ms). The value is placed on the element as a
    // data attribute when it is rendered.
    const effectiveDurationMsAttr = element.getAttribute('data-duration-ms')
    const effectiveDurationMs = effectiveDurationMsAttr && !isNaN(Number(effectiveDurationMsAttr)) 
      ? Number(effectiveDurationMsAttr) 
      : 0

    // Cancel any existing scroll animation or pending timeout
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current)
      scrollAnimationRef.current = null
    }

    if (scrollTimeoutRef.current !== null) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = null
    }

    const elementRect = element.getBoundingClientRect()
    const elementHeight = elementRect.height
    const viewportHeight = window.innerHeight
    
    // Position the element ¼ from the top of the viewport so that the user has
    // some context above the current part.
    const oneFourthViewportOffset = viewportHeight / 4
    const topPosition = window.scrollY + elementRect.top - oneFourthViewportOffset
    window.scrollTo({ top: topPosition, behavior: 'instant' })

    // If content is smaller than viewport, no need to scroll
    if (elementHeight <= viewportHeight) {
      return
    }

    // Calculate how much of the element is already visible so that we only
    // scroll for the yet-to-be-seen portion.
    const initiallyVisibleHeight = Math.max(
      0,
      Math.min(elementHeight, viewportHeight - oneFourthViewportOffset)
    )

    const remainingHeight = elementHeight - initiallyVisibleHeight

    if (remainingHeight <= 0) {
      return
    }

    // Scroll distance equals the height that is still hidden below the fold.
    const scrollDistance = remainingHeight

    // Determine the target animation duration. Use the server-provided
    // `effective_duration_ms` scaled by the percentage of the part that is not
    // yet visible.
    const remainingPercent = scrollDistance / elementHeight
    const targetDuration = effectiveDurationMs * remainingPercent || 0

    // How long the currently visible content should stay on screen before we
    // begin auto-scrolling.
    const delayBeforeScroll = effectiveDurationMs * (1 - remainingPercent) || 0

    // Fallback: if the server provided an invalid/zero duration fall back to
    // a heuristic of 0.15 px/ms like before.
    const fallbackSpeed = 0.15 // px per ms

    const startScrollAnimation = () => {
      const startTime = performance.now()
      const startPosition = window.scrollY

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime

        const progress = targetDuration > 0
          ? Math.min(elapsed / targetDuration, 1)
          : Math.min((elapsed * fallbackSpeed) / scrollDistance, 1)

        if (progress < 1) {
          window.scrollTo(0, startPosition + scrollDistance * progress)
          scrollAnimationRef.current = requestAnimationFrame(animate)
        } else {
          window.scrollTo(0, startPosition + scrollDistance)
          scrollAnimationRef.current = null
        }
      }

      // Start in next frame
      requestAnimationFrame(() => {
        scrollAnimationRef.current = requestAnimationFrame(animate)
      })
    }

    if (delayBeforeScroll > 0) {
      scrollTimeoutRef.current = window.setTimeout(startScrollAnimation, delayBeforeScroll)
    } else {
      startScrollAnimation()
    }
  }, [])

  const { 
    data, 
    isLoading, 
    error 
  } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: () => fetchSessionParts(sessionId),
    staleTime: 0,
    refetchOnMount: true
  })

  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id) {
      const currentId = data.sessionData.session.current_part_id
      setCurrentPartId(String(currentId))
      const currentPartElement = partsRef.current[currentId]
      if (currentPartElement) {
        smoothScrollToPart(currentPartElement)
      }
    }
  }, [data, smoothScrollToPart])

  React.useEffect(() => {
    if (subscriptionData?.part) {
      setCurrentPartId(subscriptionData.part)
      const currentPartElement = partsRef.current[subscriptionData.part]
      if (currentPartElement) {
        smoothScrollToPart(currentPartElement)
      }
    }
  }, [subscriptionData, smoothScrollToPart])

  React.useEffect(() => {
    return () => {
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current)
      }
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>
  if (!data?.parts?.length) return <div>No parts available for this session.</div>

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {(data?.parts ?? []).map(({ part }) => {
        const isCurrentPart = part.id === Number(currentPartId)
        return (
          <div 
            className="grid grid-cols-2 gap-5 mb-5" 
            key={part.id}
            data-duration-ms={part.effective_duration_ms}
            ref={(el) => {
              if (el) {
                partsRef.current[part.id] = el
              }
            }}
          >
            <div
              key={`translit-${part.id}`}
              className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
            >
              <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
              <ReactMarkdown className="text-9xl prose prose-invert max-w-none">
                {part.translit.split('\n').map(line => line.trimStart()).join('\n\n')}
              </ReactMarkdown>
            </div>
            <div
              key={`en-${part.id}`}
              className={`p-5 bg-gray-700 rounded-lg ${!isCurrentPart ? 'text-slate-500' : ''}`}
            >
              <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
              <ReactMarkdown className="text-9xl prose prose-invert max-w-none">
                {part.en.split('\n').map(line => line.trimStart()).join('\n\n')}
              </ReactMarkdown>
            </div>
          </div>
        )
      })}
    </div>
  )
}
