import { bundledLectionary } from '@tarkman/lectionary/bundled'
import type { DayResult, Language, LectionaryDay } from '@tarkman/lectionary'

export type ReadingField = 'gospel' | 'epistle' | 'prophetic'
export type ReadingPatch = Partial<Record<ReadingField, string>>
export type ReadingSelection = Record<ReadingField, number[]>
export const readingCategories = { gospel: 'Gospel', epistle: 'Epistle' } as const

/** Prophetic is a user-assigned role, not an inferred Old Testament category. */
export function readingReferences(day: LectionaryDay, field: ReadingField): string[] {
  return field === 'prophetic' ? day.ReadingsList : day.Readings[readingCategories[field]] ?? []
}

/** The caller supplies the creation draft's date verbatim, after zone-aware bootstrap.
 * This adapter does not guess today, map liturgies to readings, or mutate the draft.
 */
export function getLectionaryDay(date: string, language: Language): Promise<DayResult> {
  return bundledLectionary.getDay(date, { language })
}

/** Public metadata keeps coverage copy independent of the installed year-file layout. */
export function lectionaryCoverage() {
  return bundledLectionary.getMetadata().coverage
}

/** Explicit selections retain source order, independent of click order. No service mapping. */
export function selectedReadings(day: LectionaryDay, selection: ReadingSelection): ReadingPatch {
  const patch: ReadingPatch = {}
  for (const field of ['gospel', 'epistle', 'prophetic'] as const) {
    const references = readingReferences(day, field)
    if (selection[field].some(index => !Number.isInteger(index) || index < 0 || index >= references.length)) throw Error('Invalid reading selection') // i18n-ignore: programmer-only invalid selection guard
    const values = references.filter((_, index) => selection[field].includes(index))
    if (values.length) patch[field] = values.join('; ')
  }
  return patch
}
