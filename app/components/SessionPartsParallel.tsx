import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePusher } from '../hooks/usePusher'
import { usePartScroll } from '../hooks/usePartScroll'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'

interface SessionPartsParallelProps {
  sessionId: string
}

export function SessionPartsParallel({ sessionId }: SessionPartsParallelProps) {
  const { partsRef, handlePartUpdated } = usePartScroll()
  const subscriptionData = usePusher(`channel_${sessionId}`, 'part_change')
  const scrollAnimationRef = React.useRef<number | null>(null)

  const smoothScrollToPart = React.useCallback((element: HTMLElement) => {
    // Cancel any existing scroll animation
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current)
      scrollAnimationRef.current = null
    }

    const elementRect = element.getBoundingClientRect()
    const elementHeight = elementRect.height
    const viewportHeight = window.innerHeight
    
    // Immediately position the element at the top of the viewport
    const topPosition = window.scrollY + elementRect.top
    window.scrollTo({ top: topPosition, behavior: 'instant' })

    // If content is smaller than viewport, no need to scroll
    if (elementHeight <= viewportHeight) {
      return
    }

    // Calculate the distance to scroll (from top to bottom of the element)
    const scrollDistance = elementHeight - viewportHeight

    // Calculate scroll duration based on content length
    const baseSpeed = 0.15 // pixels per millisecond (adjusted for smoother scroll)
    const contentRatio = elementHeight / viewportHeight
    const adjustedSpeed = baseSpeed / Math.log2(contentRatio + 1)

    const startTime = performance.now()
    const startPosition = window.scrollY

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed * adjustedSpeed / scrollDistance, 1)
      
      if (progress < 1) {
        window.scrollTo(0, startPosition + scrollDistance * progress)
        scrollAnimationRef.current = requestAnimationFrame(animate)
      } else {
        window.scrollTo(0, startPosition + scrollDistance)
        scrollAnimationRef.current = null
      }
    }

    // Start the animation in the next frame to ensure the initial scroll has completed
    requestAnimationFrame(() => {
      scrollAnimationRef.current = requestAnimationFrame(animate)
    })
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
      const currentPartElement = partsRef.current[data.sessionData.session.current_part_id]
      if (currentPartElement) {
        smoothScrollToPart(currentPartElement)
      }
    }
  }, [data, smoothScrollToPart])

  React.useEffect(() => {
    if (subscriptionData?.part) {
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
    }
  }, [])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading parts</div>

  return (
    <div className="relative w-screen left-[50%] right-[50%] -mx-[50vw] bg-gray-800 text-white p-5 shadow-md">
      {data?.parts.map(({ part }) => (
        <div 
          className="grid grid-cols-2 gap-5 mb-5" 
          key={part.id}
          ref={(el) => {
            if (el) {
              partsRef.current[part.id] = el
            }
          }}
        >
          <div
            key={`en-${part.id}`}
            className="p-5 bg-gray-700 rounded-lg"
          >
            <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
            <div className="text-9xl">{part.translit}</div>
          </div>
          <div
            key={`tr-${part.id}`}
            className="p-5 bg-gray-700 rounded-lg"
          >
            <div className="font-bold uppercase text-slate-300 text-7xl">{part.role}</div>
            <div className="text-9xl">{part.en}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
