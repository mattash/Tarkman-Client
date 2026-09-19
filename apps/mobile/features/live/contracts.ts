import type { Language } from '@tarkman/core'
import { t } from '../i18n'

// Narrow public read models: the core's full Session/Explanation require fields
// Rails does not always return. No authentication or mutation model belongs here.
export interface DisplayMessages { gospel: string | null; epistle: string | null; before: string | null; after: string | null }
export interface LiveSession {
  page?: number | null; totalParts?: number | null; displayMessages?: DisplayMessages
  id: number; title: string; church: string; currentPartId: number | null
  currentLiturgyId: number | null; currentPosition: number | null
  status: string; message: string | null
  /** The service's calendar date (YYYY-MM-DD), when published. */
  date: string | null
  /** Role of the current part ("priest"), once the API publishes current_part_role; null until then. */
  currentRole: string | null
  /** Published by the API for churches that have been geocoded; absent otherwise. */
  latitude: number | null; longitude: number | null
  /** Content-related session fields, not a server revision. Reuse is bounded by a full-refresh interval. */
  partsContext: string | null
  /** Revision/occurrence may come from canonical JSON; contentContext comes from reconciled state. */
  revision?: number | null; contentContext?: string | null; currentLiturgyPartId?: number | null; posture?: string | null
}
export interface LivePart {
  page?: number | null
  id: number; key: string; liturgyId: number | null; liturgyPartId: number | null
  position: number; role: string; text: Record<Language, string | null>
  /** What the congregation does during this part ("stand"), when the service publishes one. */
  posture: string | null
}
export interface LiveExplanation { id: number; title: string; description: string | null; liturgyPartId: number | null }
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('errors.unexpectedFormat'))
  return value as Record<string, unknown>
}
export function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}
export function requiredId(value: unknown): number {
  const id = positiveId(value)
  if (id === null) throw new Error(t('errors.missingIdentifier'))
  return id
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
export function normalizeSession(value: unknown): LiveSession {
  const s = record(record(value).session)
  const options = s.options && typeof s.options === 'object' && !Array.isArray(s.options) ? s.options as Record<string, unknown> : {}
  return { id: requiredId(s.id), title: text(s.liturgy) || t('fallbacks.service'), church: text(s.church_name) || t('fallbacks.churchService'),
    revision: typeof s.revision === 'number' && Number.isSafeInteger(s.revision) && s.revision >= 0 ? s.revision : null,
    currentLiturgyPartId: positiveId(s.current_liturgy_part_id),
    currentPartId: positiveId(s.current_part_id), currentLiturgyId: positiveId(s.current_liturgy_id),
    currentPosition: s.current_part_position === 0 ? 0 : positiveId(s.current_part_position), status: text(s.status) || 'active', message: text(s.status_message),
    page: positiveId(s.page), posture: text(s.posture)?.trim() || null, totalParts: positiveId(s.num_of_parts),
    displayMessages: { gospel: text(options.gospel), epistle: text(options.epistle), before: text(options.before_message), after: text(options.after_message) },
    date: text(s.date), currentRole: text(s.current_part_role)?.trim() || null,
    latitude: coordinate(s.church_latitude, 90), longitude: coordinate(s.church_longitude, 180), partsContext: partsContext(s) }
}
function partsContext(session: Record<string, unknown>): string | null {
  // Older/incomplete API responses cannot establish that the loaded manifest still belongs to this session.
  if (!Array.isArray(session.liturgies) || !session.liturgies.length ||
      !Number.isSafeInteger(session.num_of_parts) || Number(session.num_of_parts) < 1) return null
  // Compare content inputs, not unrelated metadata: church_avatar is a signed URL that changes between reads.
  // This is deliberately not an arbitrary snapshot hash or a substitute for a server content revision.
  return JSON.stringify([session.id, session.date, session.liturgy_id, session.liturgies, session.num_of_parts,
    session.readings, session.options, session.status, session.status_message])
}
/** Only a real, in-range number counts; anything else means the church has no published position. */
function coordinate(value: unknown, limit: number): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null
}

export function normalizeServices(value: unknown): LiveSession[] {
  if (Array.isArray(value)) return uniqueSessions(value.map(normalizeSession))
  const data = record(value)
  if (data.session) return [normalizeSession(data)]
  if (Array.isArray(data.sessions)) return uniqueSessions(data.sessions.map(normalizeSession))
  if (typeof data.message === 'string' && !data.error && !data.sessions) return []
  throw new Error(t('errors.unexpectedServices'))
}
function uniqueSessions(sessions: LiveSession[]) { return [...new Map(sessions.map(s => [s.id, s])).values()] }
export function normalizeParts(value: unknown): LivePart[] {
  const rows = record(value).parts
  if (!Array.isArray(rows)) throw new Error(t('errors.unexpectedParts'))
  const keys = new Set<string>()
  return rows.map((row, index) => {
    const p = record(record(row).part)
    const id = requiredId(p.id), liturgyPartId = positiveId(p.liturgy_part_id), liturgyId = positiveId(p.liturgy_id)
    const position = positiveId(p.position) ?? index + 1
    const key = liturgyPartId ? `lp:${liturgyPartId}` : `part:${id}:liturgy:${liturgyId}:position:${position}`
    if (keys.has(key)) throw new Error(t('errors.duplicatePart'))
    keys.add(key)
    return { id, key, liturgyId, liturgyPartId, position, page: positiveId(p.page), role: text(p.role) || t('fallbacks.reading'),
      text: { en: text(p.en), ru: text(p.ru), grabar: text(p.grabar), translit: text(p.translit) }, posture: text(p.posture)?.trim() || null }
  }).sort((a, b) => a.position - b.position)
}
export function normalizeExplanations(value: unknown): LiveExplanation[] {
  const rows = record(value).explanations
  if (!Array.isArray(rows)) throw new Error(t('errors.unexpectedExplanations'))
  return rows.map(row => { const e = record(record(row).explanation)
    return { id: requiredId(e.id), title: text(e.title) || t('fallbacks.explanation'), description: text(e.description), liturgyPartId: positiveId(e.liturgy_part_id) }
  })
}
export function currentPart(session: LiveSession, parts: LivePart[]): LivePart | undefined {
  if (session.currentLiturgyPartId != null) return parts.find(p => p.liturgyPartId === session.currentLiturgyPartId &&
    p.id === session.currentPartId && p.liturgyId === session.currentLiturgyId)
  const matches = parts.filter(p => p.id === session.currentPartId && (session.currentLiturgyId === null || p.liturgyId === session.currentLiturgyId))
  return matches.length === 1 ? matches[0] : matches.find(p => p.position === session.currentPosition)
}
export interface SessionCursor { partId: number; liturgyPartId: number; liturgyId: number; position: number }
export interface SessionState {
  id: number; revision: number; contentContext: string; cursor: SessionCursor | null
  status: string; message: string | null; posture: string | null; date: string | null
}
function revision(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}
function nullableText(value: unknown): value is string | null { return value === null || typeof value === 'string' }
/** Fail closed: partial/legacy publications trigger a state read rather than an optimistic patch. */
export function parsePublication(value: unknown, id: number): SessionState | null {
  try {
    const s = record(value), rev = revision(s.revision), status = s.session_status ?? s.status
    if (rev === null || typeof s.content_context !== 'string' || !s.content_context || typeof status !== 'string' ||
        !nullableText(s.status_message) || !nullableText(s.posture) || !nullableText(s.date)) return null
    const cursor = s.cursor === null ? null : record(s.cursor)
    return { id, revision: rev, contentContext: s.content_context, status, message: s.status_message,
      posture: s.posture, date: s.date, cursor: cursor === null ? null : {
        partId: requiredId(cursor.part_id), liturgyPartId: requiredId(cursor.liturgy_part_id),
        liturgyId: requiredId(cursor.liturgy_id), position: requiredId(cursor.position),
      } }
  } catch { return null }
}
export function normalizeState(value: unknown): SessionState {
  const data = record(record(value).session), id = requiredId(data.id), state = parsePublication(data, id)
  if (!state) throw new Error(t('errors.unexpectedFormat'))
  return state
}
export function sessionWithState(session: LiveSession, update: SessionState, parts: LivePart[]): LiveSession {
  const cursor = update.cursor
  const part = parts.find(p => p.liturgyPartId === cursor?.liturgyPartId)
  return { ...session, revision: update.revision, contentContext: update.contentContext,
    currentPartId: cursor?.partId ?? null, currentLiturgyPartId: cursor?.liturgyPartId ?? null,
    currentLiturgyId: cursor?.liturgyId ?? null, currentPosition: cursor?.position ?? null,
    currentRole: part?.role ?? null, page: part?.page ?? null,
    status: update.status, message: update.message, posture: update.posture, date: update.date }
}
export type SessionEvent = { event: 'part_change' | 'status_change' | 'explanation_updated'; sessionId: number; state?: SessionState }
export function parseEvent(value: unknown): SessionEvent | null {
  try {
    const e = record(value), data = record(e.data)
    if (e.event !== 'part_change' && e.event !== 'status_change' && e.event !== 'explanation_updated') return null
    const id = positiveId(e.event === 'part_change' ? data.session : data.session_id)
    if (!id) return null
    const state = e.event === 'explanation_updated' ? null : parsePublication(data, id)
    return { event: e.event, sessionId: id, ...(state ? { state } : {}) }
  } catch { return null }
}
