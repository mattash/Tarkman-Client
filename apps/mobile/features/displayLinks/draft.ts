import type { DisplayLinkFields, ManagedDisplayLink } from '@tarkman/core'
import { editableFields, type FieldErrors } from './managementApi'
import { t } from '../i18n'

export const CREATE_DEFAULTS: DisplayLinkFields = {
  title: '', device_type: 'auto', mode: 'parallel', lang1: 'translit', lang2: 'en', font_scale: 100,
  status_view: 'full', show_notifications: true, show_explanations: false, text_movement: 'continuous',
  language_sync: 'linked', margin_percent: null, expires_at: null,
}
/**
 * Whether the backend reports publication. An older backend omits `published`, so the toggle is hidden
 * rather than sending a field it would ignore. Creating with no links yet cannot tell, so it is hidden too.
 */
export function publicationSupported(baseline: ManagedDisplayLink | undefined, links: readonly ManagedDisplayLink[]): boolean {
  return baseline ? typeof baseline.published === 'boolean' : links.some(link => typeof link.published === 'boolean')
}
export function fieldsOf(value: DisplayLinkFields): DisplayLinkFields {
  return Object.fromEntries(editableFields.map(key => [key, value[key]])) as unknown as DisplayLinkFields
}
export function changedFields(baseline: DisplayLinkFields, draft: DisplayLinkFields): Partial<DisplayLinkFields> {
  return Object.fromEntries(editableFields.filter(key => baseline[key] !== draft[key]).map(key => [key, draft[key]]))
}
export function validateDraft(draft: DisplayLinkFields): FieldErrors {
  const errors: FieldErrors = {}
  if (draft.mode === 'parallel' && !draft.lang2) errors.lang2 = t('links.secondRequired')
  if (!Number.isInteger(draft.font_scale) || draft.font_scale < 50 || draft.font_scale > 200) errors.font_scale = t('links.fontRange')
  if (draft.margin_percent !== null && (!Number.isInteger(draft.margin_percent) || draft.margin_percent < 0 || draft.margin_percent > 15)) errors.margin_percent = t('links.marginRange')
  if (draft.expires_at !== null && !Number.isFinite(Date.parse(draft.expires_at))) errors.expires_at = t('links.expiryInvalid')
  return errors
}
/** Local wall time input; only deliberately edited expiration is converted to UTC. */
export function localExpiration(value: string | null): string {
  if (!value) return ''
  const date = new Date(value), pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function parseExpiration(value: string): string | null | undefined {
  if (!value.trim()) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || localExpiration(date.toISOString()) !== value) return undefined
  return date.toISOString()
}
