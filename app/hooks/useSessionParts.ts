import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePusher } from './usePusher'
import { fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import { smoothScrollToPart } from './smoothScrollToPart'

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

  // Destructure onPartChange so the Pusher effect does not depend on the
  // whole options object (avoids re-scroll on rerender when an inline
  // object literal is passed).
  const onPartChange = options?.onPartChange

  const pusherEvents = React.useMemo(() => ['part_change', 'status_change'], [])
  const subscriptionData = usePusher(`channel_${sessionId}`, pusherEvents)

  const handleScroll = React.useCallback(
    (element: HTMLElement) => {
      smoothScrollToPart(element, {
        animation: scrollAnimationRef,
        timeout: scrollTimeoutRef,
      })
    },
    []
  )

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

  // Scroll to current part on initial data load.
  // Use != null so that a part with id 0 is not ignored.
  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id != null) {
      const currentId = data.sessionData.session.current_part_id
      setCurrentPartId(String(currentId))
      const currentPartElement = partsRef.current[currentId]
      if (currentPartElement) {
        handleScroll(currentPartElement)
      }
    }
  }, [data, handleScroll])

  // Handle Pusher part changes.
  React.useEffect(() => {
    if (subscriptionData?.part !== undefined) {
      const partId = String(subscriptionData.part)
      setCurrentPartId(partId)
      onPartChange?.(partId)
      const currentPartElement = partsRef.current[subscriptionData.part]
      if (currentPartElement) {
        handleScroll(currentPartElement)
      }
    }
    if (subscriptionData?.status) {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.session(sessionId) })
      queryClient.invalidateQueries({ queryKey: ['currentSession'] })
      queryClient.invalidateQueries({ queryKey: ['userCurrentSession'] })
    }
  }, [subscriptionData, handleScroll, queryClient, sessionId, onPartChange])

  // Cleanup scroll animations on unmount.
  React.useEffect(() => {
    return () => {
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current)
        scrollAnimationRef.current = null
      }
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
    }
  }, [])

  return {
    partsRef,
    currentPartId,
    isLoading,
    error,
    data,
  }
}
