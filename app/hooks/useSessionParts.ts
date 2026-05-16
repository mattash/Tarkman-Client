import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePusher } from './usePusher'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'

interface UseSessionPartsOptions {
  /** Called when the current part changes (via Pusher or initial data). */
  onPartChange?: (partId: string) => void
}

export function useSessionParts(sessionId: string, options?: UseSessionPartsOptions) {
  const partsRef = React.useRef<Record<string, HTMLElement>>({})
  const scrollAnimationRef = React.useRef<number | null>(null)
  const scrollTimeoutRef = React.useRef<number | null>(null)
  const [currentPartId, setCurrentPartId] = React.useState<string | null>(null)
  const queryClient = useQueryClient()

  const pusherEvents = React.useMemo(() => ['part_change', 'status_change'], [])
  const subscriptionData = usePusher(`channel_${sessionId}`, pusherEvents)

  const smoothScrollToPart = React.useCallback((element: HTMLElement) => {
    const effectiveDurationMsAttr = element.getAttribute('data-duration-ms')
    const effectiveDurationMs = effectiveDurationMsAttr && !isNaN(Number(effectiveDurationMsAttr))
      ? Number(effectiveDurationMsAttr)
      : 0

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

    const oneFourthViewportOffset = viewportHeight / 4
    const topPosition = window.scrollY + elementRect.top - oneFourthViewportOffset
    window.scrollTo({ top: topPosition, behavior: 'instant' })

    if (elementHeight <= viewportHeight) {
      return
    }

    const initiallyVisibleHeight = Math.max(
      0,
      Math.min(elementHeight, viewportHeight - oneFourthViewportOffset)
    )
    const remainingHeight = elementHeight - initiallyVisibleHeight

    if (remainingHeight <= 0) {
      return
    }

    const scrollDistance = remainingHeight
    const remainingPercent = scrollDistance / elementHeight
    const targetDuration = effectiveDurationMs * remainingPercent || 0
    const delayBeforeScroll = effectiveDurationMs * (1 - remainingPercent) || 0
    const fallbackSpeed = 0.15

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
    error,
  } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: () => fetchSessionParts(sessionId),
    staleTime: 0,
    refetchOnMount: true,
  })

  // Scroll to current part on initial data load
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

  // Handle Pusher part changes
  React.useEffect(() => {
    if (subscriptionData?.part !== undefined) {
      const partId = String(subscriptionData.part)
      setCurrentPartId(partId)
      options?.onPartChange?.(partId)
      const currentPartElement = partsRef.current[subscriptionData.part]
      if (currentPartElement) {
        smoothScrollToPart(currentPartElement)
      }
    }
    if (subscriptionData?.status) {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.session(sessionId) })
      queryClient.invalidateQueries({ queryKey: ['currentSession'] })
    }
  }, [subscriptionData, smoothScrollToPart, queryClient, sessionId, options])

  // Cleanup scroll animations on unmount
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

  return {
    partsRef,
    smoothScrollToPart,
    currentPartId,
    setCurrentPartId,
    isLoading,
    error,
    data,
  }
}
