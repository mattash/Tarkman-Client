import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useActionCable } from './useActionCable'
import { fetchSession, fetchSessionParts, sessionsKeys } from '../queries/sessions'
import { PartsResponse } from '../types/part'
import type { SessionData, SessionWrapper } from '../types/session'
import { smoothScrollToPart } from './smoothScrollToPart'
import { resolveReadingKey, type ReadingCursor } from './sessionOccurrence'

interface UseSessionPartsOptions {
  onPartChange?: (partId: string) => void
  sessionData?: SessionWrapper
}

function sessionCursor(session: SessionData): ReadingCursor | null {
  if (session.current_part_id == null) return null
  return { partId: String(session.current_part_id), occurrenceId: session.current_liturgy_part_id ?? session.cursor?.liturgy_part_id,
    position: session.current_part_position ?? undefined, liturgyId: session.current_liturgy_id, revision: session.revision }
}

export function useSessionParts(sessionId: string, options?: UseSessionPartsOptions) {
  const partsRef = React.useRef<Record<string, HTMLElement>>({})
  const [selected, setSelected] = React.useState<(ReadingCursor & { sessionId: string }) | null>(null)
  const accepted = React.useRef<{ sessionId: string; cursor: ReadingCursor; live: boolean } | null>(null)
  const lastScroll = React.useRef<{ sessionId: string; key: string; element: HTMLElement } | null>(null)
  const scrollAnimationRef = React.useRef<number | null>(null)
  const scrollTimeoutRef = React.useRef<number | null>(null)
  const queryClient = useQueryClient()
  const onPartChange = options?.onPartChange
  const knownSessionData = options?.sessionData
  const events = React.useMemo(() => ['part_change', 'status_change'], [])
  const subscriptionData = useActionCable(`channel_${sessionId}`, events)
  React.useEffect(() => {
    partsRef.current = {}
    lastScroll.current = null
  }, [sessionId])
  const { data, isLoading, error } = useQuery<PartsResponse>({
    queryKey: sessionsKeys.sessionParts(sessionId),
    queryFn: async () => {
      const sessionData = knownSessionData ?? await queryClient.fetchQuery({
        queryKey: sessionsKeys.session(sessionId), queryFn: () => fetchSession(sessionId), staleTime: 1000,
      })
      return fetchSessionParts(sessionId, sessionData)
    },
    staleTime: 0, refetchOnMount: true,
  })

  const accept = React.useCallback((cursor: ReadingCursor | null, live: boolean) => {
    if (!cursor) return
    const previous = accepted.current?.sessionId === sessionId ? accepted.current : null
    if (previous) {
      if (previous.cursor.revision != null && (cursor.revision == null || cursor.revision < previous.cursor.revision)) return
      // An unversioned snapshot embedded in cached text must not rewind a live update.
      if (!live && previous.live && cursor.revision == null) return
      if (previous.cursor.revision === cursor.revision && previous.cursor.partId === cursor.partId &&
          previous.cursor.occurrenceId === cursor.occurrenceId && previous.cursor.position === cursor.position) return
    }
    accepted.current = { sessionId, cursor, live }
    setSelected({ sessionId, ...cursor })
  }, [sessionId])

  React.useEffect(() => {
    if (data) accept(sessionCursor(data.sessionData.session), false)
  }, [data, accept])
  React.useEffect(() => {
    if (knownSessionData) accept(sessionCursor(knownSessionData.session), false)
  }, [knownSessionData, accept])
  React.useEffect(() => {
    if (subscriptionData?.part != null || subscriptionData?.cursor) {
      const cursor = subscriptionData.cursor
      accept({ partId: String(cursor?.part_id ?? subscriptionData.part), occurrenceId: cursor?.liturgy_part_id,
        position: cursor?.position, liturgyId: cursor?.liturgy_id, revision: subscriptionData.revision }, true)
    }
    if (subscriptionData?.status) {
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.session(sessionId), exact: true })
      void queryClient.invalidateQueries({ queryKey: ['currentSession'] })
      void queryClient.invalidateQueries({ queryKey: ['userCurrentSession'] })
    }
  }, [subscriptionData, accept, queryClient, sessionId])

  const current = selected?.sessionId === sessionId ? selected : null
  const currentPartKey = current && data ? resolveReadingKey(data.parts, current) : null
  React.useEffect(() => {
    const element = currentPartKey ? partsRef.current[currentPartKey] : undefined
    if (!element || !currentPartKey || !current) return
    if (lastScroll.current?.sessionId === sessionId && lastScroll.current.key === currentPartKey &&
        lastScroll.current.element === element) return
    lastScroll.current = { sessionId, key: currentPartKey, element }
    onPartChange?.(current.partId)
    smoothScrollToPart(element, { animation: scrollAnimationRef, timeout: scrollTimeoutRef })
  }, [current, currentPartKey, data, partsRef, onPartChange, sessionId])

  React.useEffect(() => () => {
    if (scrollAnimationRef.current !== null) cancelAnimationFrame(scrollAnimationRef.current)
    if (scrollTimeoutRef.current !== null) clearTimeout(scrollTimeoutRef.current)
  }, [sessionId])

  return { partsRef, currentPartId: current?.partId ?? null, currentPartKey, isLoading, error, data }
}
