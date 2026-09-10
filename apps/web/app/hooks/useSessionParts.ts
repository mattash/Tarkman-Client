import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActionCable } from './useActionCable'
import { fetchSession, fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import type { SessionWrapper } from '../types/session'
import { smoothScrollToPart } from './smoothScrollToPart'

interface UseSessionPartsOptions {
  /** Called when the current part changes (via ActionCable or initial data). */
  onPartChange?: (partId: string) => void
  /** Session data already loaded by a parent route. */
  sessionData?: SessionWrapper
}

export function useSessionParts(sessionId: string, options?: UseSessionPartsOptions) {
  const partsRef = React.useRef<Record<string, HTMLElement>>({})
  const lastNotifiedPartIdRef = React.useRef<string | null>(null)
  const hasHandledInitialDataRef = React.useRef(false)
  const receivedLivePartBeforeInitialDataRef = React.useRef(false)
  const latestLivePartIdRef = React.useRef<string | null>(null)
  const scrollAnimationRef = React.useRef<number | null>(null)
  const scrollTimeoutRef = React.useRef<number | null>(null)
  const [currentPartState, setCurrentPartState] = React.useState<{
    sessionId: string
    partId: string | null
  }>({ sessionId, partId: null })
  const queryClient = useQueryClient()
  const currentPartId = currentPartState.sessionId === sessionId
    ? currentPartState.partId
    : null

  // Destructure onPartChange so the ActionCable effect does not depend on the
  // whole options object (avoids re-scroll on rerender when an inline
  // object literal is passed).
  const onPartChange = options?.onPartChange
  const knownSessionData = options?.sessionData

  const actionCableEvents = React.useMemo(() => ['part_change', 'status_change'], [])
  const subscriptionData = useActionCable(`channel_${sessionId}`, actionCableEvents)

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
    queryFn: async () => {
      const sessionData = knownSessionData ?? await queryClient.fetchQuery({
        queryKey: sessionsKeys.session(sessionId),
        queryFn: () => fetchSession(sessionId),
        staleTime: 1000,
      })
      return fetchSessionParts(sessionId, sessionData)
    },
    staleTime: 0,
    refetchOnMount: true,
  })

  // Scroll to current part on initial data load.
  // Use != null so that a part with id 0 is not ignored.
  React.useEffect(() => {
    lastNotifiedPartIdRef.current = null
    hasHandledInitialDataRef.current = false
    receivedLivePartBeforeInitialDataRef.current = false
    latestLivePartIdRef.current = null
    partsRef.current = {}
    setCurrentPartState({ sessionId, partId: null })
  }, [sessionId])

  React.useEffect(() => {
    if (data?.sessionData.session.current_part_id != null) {
      const isInitialData = !hasHandledInitialDataRef.current
      hasHandledInitialDataRef.current = true
      if (isInitialData && receivedLivePartBeforeInitialDataRef.current) {
        const livePartId = latestLivePartIdRef.current
        const livePartElement = livePartId ? partsRef.current[livePartId] : undefined
        if (livePartElement) {
          handleScroll(livePartElement)
        }
        return
      }

      const currentId = data.sessionData.session.current_part_id
      const partId = String(currentId)
      setCurrentPartState({ sessionId, partId })
      if (lastNotifiedPartIdRef.current !== partId) {
        lastNotifiedPartIdRef.current = partId
        onPartChange?.(partId)
      }
      const currentPartElement = partsRef.current[currentId]
      if (currentPartElement) {
        handleScroll(currentPartElement)
      }
    }
  }, [data, handleScroll, onPartChange, sessionId])

  // Handle ActionCable part changes.
  React.useEffect(() => {
    if (subscriptionData?.part !== undefined) {
      if (!hasHandledInitialDataRef.current) {
        receivedLivePartBeforeInitialDataRef.current = true
      }
      const partId = String(subscriptionData.part)
      latestLivePartIdRef.current = partId
      setCurrentPartState({ sessionId, partId })
      if (lastNotifiedPartIdRef.current !== partId) {
        lastNotifiedPartIdRef.current = partId
        onPartChange?.(partId)
      }
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
