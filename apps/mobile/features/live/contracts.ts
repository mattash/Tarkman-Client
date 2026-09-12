import type { Language } from '@tarkman/core'

// Narrow public read models: the core's full Session/Explanation require fields
// Rails does not always return. No authentication or mutation model belongs here.
export interface LiveSession {
  id: number; title: string; church: string; currentPartId: number | null
  currentLiturgyId: number | null; currentPosition: number | null
  status: string; message: string | null
}
export interface LivePart {
  id: number; key: string; liturgyId: number | null; liturgyPartId: number | null
  position: number; role: string; text: Record<Language, string | null>
}
export interface LiveExplanation { id: number; title: string; description: string | null; liturgyPartId: number | null }
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected response format.')
  return value as Record<string, unknown>
}
export function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}
export function requiredId(value: unknown): number {
  const id = positiveId(value)
  if (id === null) throw new Error('Missing response identifier.')
  return id
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
export function normalizeSession(value: unknown): LiveSession {
  const s = record(record(value).session)
  return { id: requiredId(s.id), title: text(s.liturgy) || 'Service', church: text(s.church_name) || 'Church service',
    currentPartId: positiveId(s.current_part_id), currentLiturgyId: positiveId(s.current_liturgy_id),
    currentPosition: positiveId(s.current_part_position), status: text(s.status) || 'active', message: text(s.status_message) }
}
export function normalizeServices(value: unknown): LiveSession[] {
  if (Array.isArray(value)) return uniqueSessions(value.map(normalizeSession))
  const data = record(value)
  if (data.session) return [normalizeSession(data)]
  if (Array.isArray(data.sessions)) return uniqueSessions(data.sessions.map(normalizeSession))
  if (typeof data.message === 'string' && !data.error && !data.sessions) return []
  throw new Error('Unexpected services response.')
}
function uniqueSessions(sessions: LiveSession[]) { return [...new Map(sessions.map(s => [s.id, s])).values()] }
export function normalizeParts(value: unknown): LivePart[] {
  const rows = record(value).parts
  if (!Array.isArray(rows)) throw new Error('Unexpected parts response.')
  const keys = new Set<string>()
  return rows.map((row, index) => {
    const p = record(record(row).part)
    const id = requiredId(p.id), liturgyPartId = positiveId(p.liturgy_part_id), liturgyId = positiveId(p.liturgy_id)
    const position = positiveId(p.position) ?? index + 1
    const key = liturgyPartId ? `lp:${liturgyPartId}` : `part:${id}:liturgy:${liturgyId}:position:${position}`
    if (keys.has(key)) throw new Error('Duplicate part occurrence.')
    keys.add(key)
    return { id, key, liturgyId, liturgyPartId, position, role: text(p.role) || 'Reading',
      text: { en: text(p.en), ru: text(p.ru), grabar: text(p.grabar), translit: text(p.translit) } }
  }).sort((a, b) => a.position - b.position)
}
export function normalizeExplanations(value: unknown): LiveExplanation[] {
  const rows = record(value).explanations
  if (!Array.isArray(rows)) throw new Error('Unexpected explanations response.')
  return rows.map(row => { const e = record(record(row).explanation)
    return { id: requiredId(e.id), title: text(e.title) || 'Explanation', description: text(e.description), liturgyPartId: positiveId(e.liturgy_part_id) }
  })
}
export function currentPart(session: LiveSession, parts: LivePart[]): LivePart | undefined {
  const matches = parts.filter(p => p.id === session.currentPartId && (session.currentLiturgyId === null || p.liturgyId === session.currentLiturgyId))
  return matches.length === 1 ? matches[0] : matches.find(p => p.position === session.currentPosition)
}
export type SessionEvent = { event: 'part_change' | 'status_change' | 'explanation_updated'; sessionId: number }
export function parseEvent(value: unknown): SessionEvent | null {
  try {
    const e = record(value), data = record(e.data)
    if (e.event !== 'part_change' && e.event !== 'status_change' && e.event !== 'explanation_updated') return null
    const id = positiveId(e.event === 'part_change' ? data.session : data.session_id)
    if (!id) return null
    // Event content is deliberately not patched into state: these payloads are
    // partial, unordered, and part IDs alone cannot identify repeated readings.
    return { event: e.event, sessionId: id }
  } catch { return null }
}
