import { sessionReaderUrl } from '@tarkman/reader'

/** Isolated design prototype: no subscriptions, persistence, native surface, or background task. */
export const PROTOTYPE_MAX_AGE_MS = 60_000

export interface ProgressOccurrence {
  /** Stable occurrence identity, never the reusable part ID. Array order is authoritative. */
  id: number
  role: string
}
export interface ProgressManifest {
  contentContext: string
  complete: boolean
  occurrences: readonly ProgressOccurrence[]
}
/** Proposed, normalized public push contract; NOT an existing backend response or wire parser. */
export interface ProgressPublication {
  sessionId: number
  /** Increases for every publication, including freshness heartbeats, within a service. */
  sequence: number
  issuedAt: number
  expiresAt: number
  status: 'active' | 'paused' | 'unavailable' | 'ended' | 'deleted'
  title: string
  contentContext: string
  currentOccurrenceId: number | null
  manifest: ProgressManifest | null
}
export interface ProgressFollow {
  sessionId: number
  /** Unique per explicit follow/switch, including following the same service again. */
  generation: string
  removed: boolean
  snapshot: ProgressPublication | null
}
export interface ProgressDescription {
  status: 'waiting' | 'removed' | ProgressPublication['status']
  freshness: 'unknown' | 'recent' | 'stale'
  updatedAt: number | null
  expiresAt: number | null
  title: string | null
  url: string | null
  occurrenceId: number | null
  role: string | null
  /** Ordinal location, NOT percentage completed or estimated remaining time. */
  progress: { ordinal: number; total: number } | null
}
function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}
function timestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}
export function followProgress(sessionId: number, generation: string): ProgressFollow {
  if (!positiveInteger(sessionId) || !generation) throw new RangeError('Invalid progress follow') // i18n-ignore: programmer error
  return { sessionId, generation, removed: false, snapshot: null }
}
function terminal(status: ProgressPublication['status']): boolean {
  return status === 'ended' || status === 'deleted'
}
/** The eventual transport must validate/authenticate wire input before calling this typed reducer. */
export function acceptProgress(state: ProgressFollow, generation: string, publication: ProgressPublication, now: number): ProgressFollow {
  if (state.removed || generation !== state.generation || publication.sessionId !== state.sessionId ||
      (state.snapshot && terminal(state.snapshot.status))) return state
  if (!positiveInteger(publication.sequence) || (state.snapshot && publication.sequence <= state.snapshot.sequence) ||
      !timestamp(now) || !timestamp(publication.issuedAt) || !timestamp(publication.expiresAt) ||
      publication.issuedAt > now || publication.expiresAt <= publication.issuedAt ||
      publication.expiresAt - publication.issuedAt > PROTOTYPE_MAX_AGE_MS ||
      (state.snapshot && publication.issuedAt < state.snapshot.issuedAt)) return state
  // Copy transport-owned arrays: later mutations must not alter an accepted revision.
  const manifest = publication.manifest
  return { ...state, snapshot: { ...publication, manifest: manifest ? {
    ...manifest, occurrences: manifest.occurrences.map(occurrence => ({ ...occurrence })),
  } : null } }
}
export function removeProgress(state: ProgressFollow): ProgressFollow {
  return { ...state, removed: true, snapshot: null }
}
function occurrenceProgress(snapshot: ProgressPublication): Pick<ProgressDescription, 'occurrenceId' | 'role' | 'progress'> {
  const unknown = { occurrenceId: null, role: null, progress: null }
  const manifest = snapshot.manifest
  if (!manifest?.complete || !snapshot.contentContext || manifest.contentContext !== snapshot.contentContext ||
      !positiveInteger(snapshot.currentOccurrenceId ?? 0)) return unknown
  const rows = manifest.occurrences
  const ids = rows.map(row => row.id)
  if (!ids.length || ids.some(id => !positiveInteger(id)) || new Set(ids).size !== ids.length) return unknown
  const index = rows.findIndex(row => row.id === snapshot.currentOccurrenceId)
  if (index < 0) return unknown
  return { occurrenceId: rows[index].id, role: rows[index].role,
    progress: { ordinal: index + 1, total: rows.length } }
}
/** Re-evaluation models expiry only; it cannot wake an extension or guarantee an OS redraw. */
export function describeProgress(state: ProgressFollow, now: number): ProgressDescription {
  const empty: ProgressDescription = { status: state.removed ? 'removed' : 'waiting', freshness: 'unknown',
    title: null, url: null, updatedAt: null, expiresAt: null, occurrenceId: null, role: null, progress: null }
  const snapshot = state.snapshot
  if (state.removed || !snapshot) return empty
  if (snapshot.status === 'deleted') return { ...empty, status: 'deleted', updatedAt: snapshot.issuedAt }
  const fresh = timestamp(now) && now >= snapshot.issuedAt && now < snapshot.expiresAt
  return { ...empty, status: snapshot.status, freshness: fresh ? 'recent' : 'stale', title: snapshot.title,
    url: sessionReaderUrl(state.sessionId), updatedAt: snapshot.issuedAt, expiresAt: snapshot.expiresAt,
    ...(snapshot.status === 'active' || snapshot.status === 'paused' ? occurrenceProgress(snapshot) : {}) }
}
