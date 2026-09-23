import axios from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import type { PartsResponse, PartWrapper } from '@/types/part'
import type { SessionData, SessionWrapper } from '@/types/session'
import type { SessionStatus } from '@/types/status'
import { resolveReadingKey, type ReadingCursor } from '@/hooks/sessionOccurrence'
import { sessionsKeys } from './sessions'

export interface SessionStateCursor {
  partId: number
  liturgyPartId: number
  liturgyId: number
  position: number
}

export interface SessionState {
  id: number
  revision: number
  contentContext: string
  cursor: SessionStateCursor | null
  status: SessionStatus
  message: string | null
  posture: string | null
  date: string | null
}

export type PublicationResult = 'applied' | 'duplicate' | 'recover'

export const SESSION_PUBLICATION_EVENT = 'tarkman:session-publication'

export function dispatchSessionPublication(sessionId: string, value: unknown): SessionState | null {
  const state = parseSessionPublication(value, Number(sessionId))
  if (state && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_PUBLICATION_EVENT, { detail: state }))
  }
  return state
}

export function acceptCommandPublication(queryClient: QueryClient, sessionId: string, value: unknown): boolean {
  const state = parseSessionPublication(value, Number(sessionId))
  const session = queryClient.getQueryData<SessionWrapper>(sessionsKeys.session(sessionId))
  const parts = queryClient.getQueryData<PartsResponse>(sessionsKeys.sessionParts(sessionId))?.parts
  if (!state || !session || !parts || !cursorResolves(parts, state)) return false
  const currentRevision = session.session.revision
  if (currentRevision == null) return false
  if (state.revision < currentRevision) return true
  const knownContext = queryClient.getQueryData<SessionState>(sessionsKeys.state(sessionId))?.contentContext ??
    session.session.content_context ?? null
  if (knownContext !== null && knownContext !== state.contentContext) return false
  if (state.revision === currentRevision) return true
  if (state.revision !== currentRevision + 1) return false
  const updated = sessionWithState(session, state, parts)
  queryClient.setQueryData(sessionsKeys.session(sessionId), updated)
  queryClient.setQueryData(sessionsKeys.state(sessionId), state)
  dispatchSessionPublication(sessionId, value)
  return true
}

export async function recoverRejectedCommand(queryClient: QueryClient, sessionId: string): Promise<void> {
  // Refresh metadata first so the manifest request is bracketed against the canonical session it belongs to.
  await queryClient.invalidateQueries({ queryKey: sessionsKeys.session(sessionId), exact: true })
  await queryClient.invalidateQueries({ queryKey: sessionsKeys.sessionParts(sessionId), exact: true })
}

const SESSION_STATUSES = new Set<SessionStatus>([
  'active',
  'paused',
  'showing_gospel',
  'showing_epistle',
  'showing_welcome',
  'showing_custom',
])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function positiveIdentifier(value: unknown): number | null {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return positiveInteger(Number(value))
  return positiveInteger(value)
}

function revision(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

export function parseSessionPublication(value: unknown, fallbackId?: number): SessionState | null {
  const data = record(value)
  if (!data) return null
  const id = [data.id, data.session, data.session_id, fallbackId]
    .map(positiveIdentifier)
    .find((candidate): candidate is number => candidate !== null) ?? null
  const stateRevision = revision(data.revision)
  const contentContext = data.content_context
  const status = data.session_status ?? data.status
  if (id === null || stateRevision === null || typeof contentContext !== 'string' || contentContext.length === 0 ||
      typeof status !== 'string' || !SESSION_STATUSES.has(status as SessionStatus) ||
      !nullableText(data.status_message) || !nullableText(data.posture) || !nullableText(data.date)) {
    return null
  }

  let cursor: SessionStateCursor | null = null
  if (data.cursor !== null) {
    const rawCursor = record(data.cursor)
    if (!rawCursor) return null
    const partId = positiveInteger(rawCursor.part_id)
    const liturgyPartId = positiveInteger(rawCursor.liturgy_part_id)
    const liturgyId = positiveInteger(rawCursor.liturgy_id)
    const position = positiveInteger(rawCursor.position)
    if (partId === null || liturgyPartId === null || liturgyId === null || position === null) return null
    cursor = { partId, liturgyPartId, liturgyId, position }
  }

  return {
    id,
    revision: stateRevision,
    contentContext,
    cursor,
    status: status as SessionStatus,
    message: data.status_message,
    posture: data.posture,
    date: data.date,
  }
}

export function normalizeSessionState(value: unknown): SessionState {
  const wrapper = record(value)
  const parsed = parseSessionPublication(wrapper?.session)
  if (!parsed) throw new Error('Unexpected session state response')
  return parsed
}

export async function fetchSessionState(sessionId: string): Promise<SessionState | null> {
  try {
    const { data } = await api.get<unknown>(`/s/${sessionId}/state.json`)
    return normalizeSessionState(data)
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) return null
    throw error
  }
}

export function stateCursor(state: SessionState): ReadingCursor | null {
  return state.cursor ? {
    partId: String(state.cursor.partId),
    occurrenceId: state.cursor.liturgyPartId,
    liturgyId: state.cursor.liturgyId,
    position: state.cursor.position,
    revision: state.revision,
  } : null
}

export function cursorResolves(parts: PartWrapper[], state: SessionState): boolean {
  return state.cursor === null || resolveReadingKey(parts, stateCursor(state)!) !== null
}

export function sessionWithState(wrapper: SessionWrapper, state: SessionState, parts: PartWrapper[]): SessionWrapper {
  const cursor = state.cursor
  const currentPart = cursor
    ? parts.find(({ part }) => part.liturgy_part_id === cursor.liturgyPartId)
    : undefined
  const session: SessionData = {
    ...wrapper.session,
    revision: state.revision,
    content_context: state.contentContext,
    current_part_id: cursor?.partId ?? null,
    current_liturgy_part_id: cursor?.liturgyPartId ?? null,
    current_liturgy_id: cursor?.liturgyId,
    current_part_position: cursor?.position ?? null,
    status: state.status,
    status_message: state.message,
    posture: state.posture,
    date: state.date ?? wrapper.session.date,
    page: currentPart?.part.page ?? wrapper.session.page,
  }
  return { session }
}

export function publicationResult(
  baseRevision: number | null | undefined,
  manifestContext: string | null,
  update: SessionState,
): PublicationResult {
  if (baseRevision == null) return 'recover'
  if (update.revision < baseRevision) return 'duplicate'
  if (update.contentContext !== manifestContext) return 'recover'
  if (update.revision === baseRevision) return 'duplicate'
  return update.revision === baseRevision + 1 ? 'applied' : 'recover'
}
