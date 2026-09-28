import { isCalendarDate, OPTION_KEYS, type LiturgyOption, type OptionKey, type SessionOptions, type SessionSetup } from './contracts'
import { t } from '../../i18n'

/** The editable form: calendar date, ordered liturgy selections (with their names), and the four text options. */
export interface SessionDraft { date: string; liturgies: LiturgyOption[]; options: SessionOptions }

export const EMPTY_OPTIONS: SessionOptions = Object.fromEntries(OPTION_KEYS.map(key => [key, ''])) as SessionOptions

export function draftSetup(draft: SessionDraft): SessionSetup {
  return { date: draft.date, liturgy_ids: draft.liturgies.map(item => item.id), options: { ...draft.options } }
}

export function sameDraft(a: SessionDraft, b: SessionDraft): boolean {
  return a.date === b.date && a.liturgies.map(item => item.id).join(',') === b.liturgies.map(item => item.id).join(',') &&
    OPTION_KEYS.every(key => a.options[key] === b.options[key])
}

/** Adds a liturgy once, at the end of the explicit order. */
export function addLiturgy(draft: SessionDraft, liturgy: LiturgyOption): SessionDraft {
  if (draft.liturgies.some(item => item.id === liturgy.id)) return draft
  return { ...draft, liturgies: [...draft.liturgies, liturgy] }
}
export function removeLiturgy(draft: SessionDraft, id: number): SessionDraft {
  return { ...draft, liturgies: draft.liturgies.filter(item => item.id !== id) }
}
export function moveLiturgy(draft: SessionDraft, id: number, offset: -1 | 1): SessionDraft {
  const from = draft.liturgies.findIndex(item => item.id === id), to = from + offset
  if (from < 0 || to < 0 || to >= draft.liturgies.length) return draft
  const liturgies = [...draft.liturgies]
  ;[liturgies[from], liturgies[to]] = [liturgies[to], liturgies[from]]
  return { ...draft, liturgies }
}

/** Shifts a calendar date by whole days with UTC arithmetic, so no device time zone can move it. */
export function shiftDate(date: string, days: number): string {
  if (!isCalendarDate(date)) return date
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

/** Today's calendar date in the backend's declared zone; the bootstrap default when this device cannot tell. */
export function todayIn(timeZone: string, fallback: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const part = (type: string) => parts.find(item => item.type === type)?.value
    const date = `${part('year')}-${part('month')}-${part('day')}`
    return isCalendarDate(date) ? date : fallback
  } catch { return fallback }
}

export type FormField = 'date' | 'liturgy_ids' | OptionKey
export const FORM_FIELDS: readonly FormField[] = ['date', 'liturgy_ids', ...OPTION_KEYS]

/** Local checks before anything is sent; the server remains the authority. */
export function localErrors(draft: SessionDraft, limits?: { maxLiturgies: number | null; optionMaxLength: Partial<Record<OptionKey, number>> }): Partial<Record<FormField, string>> {
  const errors: Partial<Record<FormField, string>> = {}
  if (!isCalendarDate(draft.date)) errors.date = t('sessionManagement.dateInvalid')
  if (draft.liturgies.length === 0) errors.liturgy_ids = t('sessionManagement.selectedEmpty')
  else if (limits?.maxLiturgies && draft.liturgies.length > limits.maxLiturgies) errors.liturgy_ids = t('sessionManagement.tooManyLiturgies', { max: limits.maxLiturgies })
  for (const key of OPTION_KEYS) {
    const max = limits?.optionMaxLength[key]
    if (max && draft.options[key].length > max) errors[key] = t('sessionManagement.tooLong', { max })
  }
  return errors
}

/** Maps backend `errors_by_field` keys onto form fields; anything else joins the summary. */
export function mapFieldErrors(fields: Record<string, string[]>): { byField: Partial<Record<FormField, string>>; other: string[] } {
  const byField: Partial<Record<FormField, string>> = {}, other: string[] = []
  for (const [key, messages] of Object.entries(fields)) {
    const field = key.replace(/^session\./, '').replace(/^options\./, '') as FormField
    if (FORM_FIELDS.includes(field)) byField[field] = messages.join(' ')
    else other.push(...messages)
  }
  return { byField, other }
}
