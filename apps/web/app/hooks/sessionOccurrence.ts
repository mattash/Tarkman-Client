import type { Part, PartWrapper } from '../types/part'

export interface ReadingCursor {
  partId: string
  occurrenceId?: number | null
  position?: number
  liturgyId?: number
  revision?: number
}

export const readingKey = (part: Part) => part.liturgy_part_id != null ? `lp:${part.liturgy_part_id}` : String(part.id)

/** Exact slots are authoritative. A missing exact slot must never select another use of the same text. */
export function resolveReadingKey(parts: PartWrapper[], cursor: ReadingCursor): string | null {
  const candidates = parts.filter(({ part }) => String(part.id) === cursor.partId)
  if (cursor.occurrenceId != null) {
    const match = candidates.find(({ part }) => part.liturgy_part_id === cursor.occurrenceId)
    return match ? readingKey(match.part) : null
  }
  const positioned = candidates.find(({ part }) => part.position === cursor.position &&
    (cursor.liturgyId == null || part.liturgy_id === cursor.liturgyId))
  const first = positioned ?? candidates[0]
  return first ? readingKey(first.part) : cursor.partId
}
