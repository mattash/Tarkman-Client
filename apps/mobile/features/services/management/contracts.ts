import { record } from '../../live/contracts'
import { t } from '../../i18n'

/**
 * Session management (create/edit/delete) contract, version 1 (mattash/Tarkman#454).
 * Kept separate from the public reader normalization: every shape here is authenticated,
 * owner-scoped, and validated strictly so an older or foreign backend reads as unavailable.
 */
export const SCHEMA_VERSION = 1
export const SESSION_MANAGEMENT_VERSION = 1
export const OPTION_KEYS = ['gospel', 'epistle', 'before_message', 'after_message'] as const
export type OptionKey = typeof OPTION_KEYS[number]
export type SessionOptions = Record<OptionKey, string>

export interface ManagementLimits { maxLiturgies: number | null; optionMaxLength: Partial<Record<OptionKey, number>> }
export interface ManagementBootstrap { timeZone: string; defaultDate: string; defaultOptions: SessionOptions; limits: ManagementLimits }
export interface LiturgyOption { id: number; name: string; selectable: boolean }
export interface LiturgyOptionsPage { liturgies: LiturgyOption[]; nextAfterId: number | null }
export interface ManagedSession {
  id: number
  title: string
  date: string
  revision: number
  status: string | null
  /** Ordered selections, including ones no longer offered for new selection. */
  liturgies: LiturgyOption[]
  options: SessionOptions
}
export interface CreateResult { session: ManagedSession; replayed: boolean }

/** Only these attributes are ever sent: never user, status, cursor, revision, or raw list objects. */
export interface SessionSetup { date: string; liturgy_ids: number[]; options: SessionOptions }
export interface SessionPatch { date?: string; liturgy_ids?: number[]; options?: Partial<SessionOptions> }

export type ManagementErrorKind =
  | 'validation' | 'forbidden' | 'unavailable' | 'uncertain' | 'conflict' | 'creationDeleted'
  | 'stale' | 'cursorReset' | 'notFound' | 'network'
export class ManagementError extends Error {
  constructor(readonly kind: ManagementErrorKind, message: string, readonly fields: Record<string, string[]> = {},
    readonly body: unknown = null) {
    super(message)
    this.name = 'ManagementError'
  }
}
export function isManagementError(error: unknown, kind?: ManagementErrorKind): error is ManagementError {
  return error instanceof ManagementError && (kind === undefined || error.kind === kind)
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
/** A real calendar date in `YYYY-MM-DD`; checked by arithmetic, never through a device time zone. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(DATE)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

export function unavailableError(): ManagementError { return new ManagementError('unavailable', t('sessionManagement.unavailable')) }
function strict<T>(read: () => T): T {
  try { return read() } catch (error) { throw isManagementError(error) ? error : unavailableError() }
}
function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw unavailableError()
  return value
}
function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}
function options(value: unknown): SessionOptions {
  const data = value === undefined || value === null ? {} : record(value)
  return Object.fromEntries(OPTION_KEYS.map(key => {
    const text = data[key]
    if (text === undefined || text === null) return [key, '']
    if (typeof text !== 'string') throw unavailableError()
    return [key, text]
  })) as SessionOptions
}
function liturgy(value: unknown): LiturgyOption {
  const data = record(value)
  if (typeof data.name !== 'string' || !data.name.trim()) throw unavailableError()
  return { id: id(data.id), name: data.name, selectable: data.selectable !== false }
}

export function normalizeBootstrap(value: unknown): ManagementBootstrap {
  return strict(() => {
    const data = record(value)
    if (data.schema_version !== SCHEMA_VERSION || data.session_management_version !== SESSION_MANAGEMENT_VERSION) throw unavailableError()
    const defaults = record(data.defaults)
    if (typeof data.time_zone !== 'string' || !data.time_zone.trim() || !isCalendarDate(defaults.date)) throw unavailableError()
    const limits = data.limits === undefined || data.limits === null ? {} : record(data.limits)
    const lengths = limits.option_max_length === undefined || limits.option_max_length === null ? {} : record(limits.option_max_length)
    return { timeZone: data.time_zone, defaultDate: defaults.date, defaultOptions: options(defaults.options),
      limits: { maxLiturgies: positiveInteger(limits.max_liturgies),
        optionMaxLength: Object.fromEntries(OPTION_KEYS.flatMap(key => positiveInteger(lengths[key]) ? [[key, lengths[key] as number]] : [])) } }
  })
}

/** `{ schema_version, liturgies: [{ id, name }], next_after_id }`; a null continuation means the catalog is complete. */
export function normalizeLiturgyOptions(value: unknown): LiturgyOptionsPage {
  return strict(() => {
    const data = record(value)
    if (data.schema_version !== SCHEMA_VERSION || !Array.isArray(data.liturgies)) throw unavailableError()
    const next = data.next_after_id === null ? null : id(data.next_after_id)
    return { liturgies: data.liturgies.map(item => ({ ...liturgy(item), selectable: true })), nextAfterId: next }
  })
}

/** The canonical nested `session` in a management response; legacy top-level POST fields are never read. */
export function normalizeManagedSession(value: unknown): ManagedSession {
  return strict(() => {
    const s = record(record(value).session)
    if (!isCalendarDate(s.date) || typeof s.revision !== 'number' || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.liturgies)) throw unavailableError()
    const liturgies = s.liturgies.map(item => ({ item: liturgy(item), position: record(item).position }))
      .map((entry, index) => ({ ...entry, position: typeof entry.position === 'number' ? entry.position : index }))
      .sort((a, b) => a.position - b.position).map(entry => entry.item)
    if (new Set(liturgies.map(item => item.id)).size !== liturgies.length) throw unavailableError()
    if (Array.isArray(s.liturgy_ids) && s.liturgy_ids.join(',') !== liturgies.map(item => item.id).join(',')) throw unavailableError()
    const title = typeof s.liturgy === 'string' && s.liturgy.trim() ? s.liturgy : liturgies.map(item => item.name).join(' · ')
    return { id: id(s.id), title, date: s.date, revision: s.revision, status: typeof s.status === 'string' ? s.status : null,
      liturgies, options: options(s.options) }
  })
}

export function normalizeCreateResult(value: unknown, status: number): CreateResult {
  let replayed = false
  try { replayed = status === 200 && record(value).replayed === true } catch { /* read below as uncertain */ }
  try {
    if (status !== 201 && !replayed) throw unavailableError()
    return { session: normalizeManagedSession(value), replayed }
  } catch {
    // The server accepted the request, but its answer cannot be read: the outcome is unknown, not failed.
    throw new ManagementError('uncertain', t('sessionManagement.uncertain'))
  }
}

export function normalizeEditSnapshot(value: unknown): ManagedSession {
  return strict(() => {
    if (record(value).schema_version !== SCHEMA_VERSION) throw unavailableError()
    return normalizeManagedSession(value)
  })
}

/** The stable error code (`code`, or the older `error` field). */
export function errorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  return typeof data.code === 'string' ? data.code : typeof data.error === 'string' ? data.error : null
}

/** Field errors keyed as the backend reports them (`date`, `liturgy_ids`, `options.gospel`, or `base`). */
export function fieldErrors(value: unknown): Record<string, string[]> {
  try {
    const errors = record(record(value).errors_by_field)
    return Object.fromEntries(Object.entries(errors).flatMap(([key, messages]) => {
      const list = (Array.isArray(messages) ? messages : [messages]).filter((item): item is string => typeof item === 'string' && !!item.trim())
      return list.length ? [[key, list]] : []
    }))
  } catch { return {} }
}

export function setupPayload(setup: SessionSetup): SessionSetup {
  return { date: setup.date, liturgy_ids: [...setup.liturgy_ids],
    options: Object.fromEntries(OPTION_KEYS.map(key => [key, setup.options[key] ?? ''])) as SessionOptions }
}

/** Key-wise difference from the saved baseline; `null` when nothing changed. */
export function setupDiff(baseline: SessionSetup, draft: SessionSetup): SessionPatch | null {
  const diff: SessionPatch = {}
  if (draft.date !== baseline.date) diff.date = draft.date
  if (draft.liturgy_ids.join(',') !== baseline.liturgy_ids.join(',')) diff.liturgy_ids = [...draft.liturgy_ids]
  const changed = OPTION_KEYS.filter(key => (draft.options[key] ?? '') !== (baseline.options[key] ?? ''))
  if (changed.length) diff.options = Object.fromEntries(changed.map(key => [key, draft.options[key] ?? '']))
  return Object.keys(diff).length ? diff : null
}

export function setupOf(session: ManagedSession): SessionSetup {
  return { date: session.date, liturgy_ids: session.liturgies.map(item => item.id), options: { ...session.options } }
}
