import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useActionCableState } from './useActionCable'
import { fetchSession, fetchSessionParts, sessionsKeys } from '@/queries/sessions'
import {
  cursorResolves,
  fetchSessionState,
  parseSessionPublication,
  publicationResult,
  SESSION_PUBLICATION_EVENT,
  sessionWithState,
  type SessionState,
} from '@/queries/sessionState'
import type { PartsResponse, PartWrapper } from '@/types/part'
import type { SessionWrapper } from '@/types/session'
import { resolveReadingKey, type ReadingCursor } from './sessionOccurrence'
import { smoothScrollToPart } from './smoothScrollToPart'

const SAFETY_POLL_MS = 30000

type ConnectionState = 'connected' | 'recovering' | 'disconnected'

interface LiveSnapshot {
  session: SessionWrapper
  parts: PartWrapper[]
  manifestContext: string | null
}

export interface LiveSessionReading {
  sessionData: SessionWrapper
  parts: PartWrapper[]
  partsRef: React.MutableRefObject<Record<string, HTMLElement>>
  currentPartId: string | null
  currentPartKey: string | null
  isLoading: boolean
  error: Error | null
  connectionState: ConnectionState
}

function sessionCursor(session: SessionWrapper['session']): ReadingCursor | null {
  if (session.current_part_id == null) return null
  return {
    partId: String(session.current_part_id),
    occurrenceId: session.current_liturgy_part_id ?? session.cursor?.liturgy_part_id,
    position: session.current_part_position ?? undefined,
    liturgyId: session.current_liturgy_id,
    revision: session.revision,
  }
}

function legacyContentContext(session: SessionWrapper['session']): string {
  return JSON.stringify([
    session.id,
    session.date,
    session.liturgy_id,
    session.liturgies,
    session.num_of_parts,
    session.readings,
    session.options,
  ])
}

export function useLiveSession(
  sessionId: string,
  initialSession: SessionWrapper,
  onPartChange?: (partId: string) => void,
): LiveSessionReading {
  const queryClient = useQueryClient()
  const sessionPartsRef = React.useRef<{ sessionId: string; ref: React.MutableRefObject<Record<string, HTMLElement>> }>({
    sessionId,
    ref: { current: {} },
  })
  if (sessionPartsRef.current.sessionId !== sessionId) {
    sessionPartsRef.current = { sessionId, ref: { current: {} } }
  }
  const partsRef = sessionPartsRef.current.ref
  const [snapshot, setSnapshot] = React.useState<LiveSnapshot>({
    session: initialSession,
    parts: [],
    manifestContext: null,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [recovering, setRecovering] = React.useState(true)
  const snapshotRef = React.useRef(snapshot)
  const observedRevision = React.useRef(initialSession.session.revision ?? 0)
  const generation = React.useRef(0)
  const recovery = React.useRef<Promise<void> | null>(null)
  const queuedRecovery = React.useRef(false)
  const queuedFull = React.useRef(false)
  const invalidations = React.useRef(0)
  const stateSupported = React.useRef<boolean | null>(null)
  const lastScroll = React.useRef<{ key: string; element: HTMLElement } | null>(null)
  const lastScrollSession = React.useRef(sessionId)
  if (lastScrollSession.current !== sessionId) {
    lastScrollSession.current = sessionId
    lastScroll.current = null
  }
  const scrollAnimationRef = React.useRef<number | null>(null)
  const scrollTimeoutRef = React.useRef<number | null>(null)
  const events = React.useMemo(() => ['part_change', 'status_change'], [])
  const cable = useActionCableState(`channel_${sessionId}`, events)
  const previousConnected = React.useRef(cable.connected)
  const hasConnected = React.useRef(cable.connected)
  const reconnectSatisfiedRevision = React.useRef<number | null>(null)

  React.useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const acceptSnapshot = React.useCallback((next: LiveSnapshot) => {
    snapshotRef.current = next
    observedRevision.current = Math.max(observedRevision.current, next.session.session.revision ?? 0)
    setSnapshot(next)
    setError(null)
    setIsLoading(false)
  }, [])

  const recoverOnce = React.useCallback(async (currentGeneration: number, full: boolean) => {
    const current = snapshotRef.current
    const beforeInvalidations = invalidations.current
    const before = await fetchSessionState(sessionId)
    if (generation.current !== currentGeneration) return

    if (before === null) {
      stateSupported.current = false
      const metadata = await fetchSession(sessionId)
      if (generation.current !== currentGeneration) return
      const context = legacyContentContext(metadata.session)
      const cursor = sessionCursor(metadata.session)
      const needsParts = full || current.parts.length === 0 || current.manifestContext !== context ||
        (cursor !== null && resolveReadingKey(current.parts, cursor) === null)
      const loaded = needsParts ? await fetchSessionParts(sessionId, metadata) : null
      if (generation.current !== currentGeneration || beforeInvalidations !== invalidations.current) return
      const parts = loaded?.parts ?? current.parts
      if (loaded) queryClient.setQueryData<PartsResponse>(sessionsKeys.sessionParts(sessionId), loaded)
      queryClient.setQueryData(sessionsKeys.session(sessionId), metadata)
      acceptSnapshot({ session: metadata, parts, manifestContext: context })
      return
    }

    stateSupported.current = true
    observedRevision.current = Math.max(observedRevision.current, before.revision)
    const knownCursor = cursorResolves(current.parts, before)
    const contentChanged = current.manifestContext !== before.contentContext
    const fetchMetadata = full || current.parts.length === 0 || contentChanged
    const fetchParts = current.parts.length === 0 || contentChanged || !knownCursor
    const metadata = fetchMetadata ? await fetchSession(sessionId) : current.session
    const loaded = fetchParts ? await fetchSessionParts(sessionId, metadata) : null
    const verify = fetchMetadata || fetchParts
    const after = verify ? await fetchSessionState(sessionId) : before
    if (generation.current !== currentGeneration) return
    if (!after || after.id !== Number(sessionId) || before.id !== Number(sessionId)) throw new Error('Unexpected session state response')
    if (before.contentContext !== after.contentContext) {
      queuedRecovery.current = true
      queuedFull.current = true
      return
    }
    if (beforeInvalidations !== invalidations.current) {
      return
    }
    if (after.revision < observedRevision.current ||
        (current.session.session.revision != null && after.revision < current.session.session.revision)) {
      throw new Error('A stale session response was refused')
    }
    const parts = loaded?.parts ?? current.parts
    if (!cursorResolves(parts, after)) throw new Error('The current reading is missing from the manifest')
    const reconciled = sessionWithState(metadata, after, parts)
    if (loaded) queryClient.setQueryData<PartsResponse>(sessionsKeys.sessionParts(sessionId), {
      parts,
      sessionData: reconciled,
    })
    queryClient.setQueryData(sessionsKeys.session(sessionId), reconciled)
    queryClient.setQueryData(sessionsKeys.state(sessionId), after)
    acceptSnapshot({ session: reconciled, parts, manifestContext: after.contentContext })
  }, [acceptSnapshot, queryClient, sessionId])

  const recover = React.useCallback((full = false) => {
    if (recovery.current) {
      invalidations.current += 1
      queuedRecovery.current = true
      queuedFull.current ||= full
      return recovery.current
    }
    const currentGeneration = generation.current
    setRecovering(true)
    const request = (async () => {
      try {
        await recoverOnce(currentGeneration, full)
      } catch (failure) {
        if (generation.current === currentGeneration) {
          setError(failure instanceof Error ? failure : new Error('Unable to refresh the session'))
          setIsLoading(false)
        }
      } finally {
        if (generation.current === currentGeneration) setRecovering(false)
      }
    })()
    const tracked = request.finally(() => {
      if (recovery.current !== tracked) return
      recovery.current = null
      if (generation.current === currentGeneration && queuedRecovery.current) {
        const runFull = queuedFull.current
        queuedRecovery.current = false
        queuedFull.current = false
        void recover(runFull)
      }
    })
    recovery.current = tracked
    return tracked
  }, [recoverOnce])

  const applyPublication = React.useCallback((update: SessionState) => {
    if (update.id !== Number(sessionId)) return
    observedRevision.current = Math.max(observedRevision.current, update.revision)
    const current = snapshotRef.current
    const result = publicationResult(current.session.session.revision, current.manifestContext, update)
    if (result === 'duplicate') return
    const resolves = cursorResolves(current.parts, update)
    const recoveringNow = recovery.current !== null
    if (result === 'recover' || !resolves) {
      invalidations.current += 1
      if (recoveringNow) queuedRecovery.current = true
      else void recover(false)
      return
    }
    // A contiguous publication is already canonical. If it supersedes a safety/focus recovery,
    // invalidate that response but do not schedule routine verification of the publication.
    if (recoveringNow) invalidations.current += 1
    const session = sessionWithState(current.session, update, current.parts)
    // ActionCable can batch subscription confirmation and the first publication after reconnect.
    // That publication is processed before the connection effect below. A contiguous update proves
    // that this reconnect missed no revision, so the connection effect need not verify it again.
    if (cable.connected && !previousConnected.current) reconnectSatisfiedRevision.current = update.revision
    queryClient.setQueryData(sessionsKeys.session(sessionId), session)
    queryClient.setQueryData(sessionsKeys.state(sessionId), update)
    acceptSnapshot({ ...current, session })
  }, [acceptSnapshot, cable.connected, queryClient, recover, sessionId])

  React.useEffect(() => {
    generation.current += 1
    recovery.current = null
    snapshotRef.current = { session: initialSession, parts: [], manifestContext: null }
    setSnapshot(snapshotRef.current)
    observedRevision.current = initialSession.session.revision ?? 0
    stateSupported.current = null
    invalidations.current = 0
    queuedRecovery.current = false
    queuedFull.current = false
    setIsLoading(true)
    setError(null)
    void recover(true)
    return () => {
      generation.current += 1
    }
  }, [sessionId, initialSession.session.id, recover])

  React.useEffect(() => {
    const publication = parseSessionPublication(cable.message, Number(sessionId))
    if (publication) applyPublication(publication)
    else if (cable.message) {
      invalidations.current += 1
      void recover(false)
    }
  }, [applyPublication, cable.message, recover, sessionId])

  React.useEffect(() => {
    if (cable.connected && !previousConnected.current && hasConnected.current) {
      const reconnectAlreadyCanonical = reconnectSatisfiedRevision.current === snapshotRef.current.session.session.revision
      reconnectSatisfiedRevision.current = null
      if (!reconnectAlreadyCanonical && !recovery.current) void recover(false)
    }
    if (!cable.connected) reconnectSatisfiedRevision.current = null
    if (cable.connected) hasConnected.current = true
    previousConnected.current = cable.connected
  }, [cable.connected, recover])

  React.useEffect(() => {
    const handleFocus = () => void recover(false)
    const handlePublication = (event: Event) => {
      const state = (event as CustomEvent<SessionState>).detail
      if (state) applyPublication(state)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener(SESSION_PUBLICATION_EVENT, handlePublication)
    const poll = window.setInterval(() => void recover(false), SAFETY_POLL_MS)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(SESSION_PUBLICATION_EVENT, handlePublication)
      window.clearInterval(poll)
    }
  }, [applyPublication, recover])

  const cursor = sessionCursor(snapshot.session.session)
  const currentPartKey = cursor ? resolveReadingKey(snapshot.parts, cursor) : null
  React.useEffect(() => {
    const element = currentPartKey ? partsRef.current[currentPartKey] : undefined
    if (!element || !currentPartKey || !cursor) return
    if (lastScroll.current?.key === currentPartKey && lastScroll.current.element === element) return
    lastScroll.current = { key: currentPartKey, element }
    onPartChange?.(cursor.partId)
    smoothScrollToPart(element, { animation: scrollAnimationRef, timeout: scrollTimeoutRef })
  }, [currentPartKey, cursor, onPartChange, partsRef])

  React.useEffect(() => () => {
    if (scrollAnimationRef.current !== null) cancelAnimationFrame(scrollAnimationRef.current)
    if (scrollTimeoutRef.current !== null) clearTimeout(scrollTimeoutRef.current)
  }, [sessionId])

  return {
    sessionData: snapshot.session,
    parts: snapshot.parts,
    partsRef,
    currentPartId: cursor?.partId ?? null,
    currentPartKey,
    isLoading,
    error,
    connectionState: recovering ? 'recovering' : error || !cable.connected ? 'disconnected' : 'connected',
  }
}
