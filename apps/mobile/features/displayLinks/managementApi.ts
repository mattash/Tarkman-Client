import type { DisplayLinkFields, ManagedDisplayLink } from '@tarkman/core'
import type { AuthContextValue } from '../auth/AuthProvider'
import { record } from '../live/contracts'
import { t } from '../i18n'
import { completeConfig } from './configState'

export const editableFields = ['title', 'device_type', 'mode', 'lang1', 'lang2', 'font_scale', 'status_view',
  'show_notifications', 'show_explanations', 'text_movement', 'language_sync', 'margin_percent', 'expires_at'] as const
/** Fields whose 422 messages are shown to the user; `published` is not a configuration field. */
export const errorFields = [...editableFields, 'published'] as const
export type FieldErrors = Partial<Record<keyof DisplayLinkFields | 'published', string>>
export class ManagementError extends Error {
  constructor(readonly status: number, readonly fields: FieldErrors = {}, readonly current?: ManagedDisplayLink) {
    super(t(status === 409 ? 'links.conflict' : status === 422 ? 'links.validation' : status === 403 || status === 404 ? 'links.unavailable' : 'links.loadFailed'))
  }
}
export function managedLink(value: unknown): ManagedDisplayLink {
  const raw = record(value), config = completeConfig(raw)
  if (!config || !Number.isSafeInteger(raw.id) || Number(raw.id) <= 0 || typeof raw.created_at !== 'string' || !Number.isFinite(Date.parse(raw.created_at)) || typeof raw.display_url !== 'string') throw new Error(t('links.loadFailed'))
  // Older backends omit both publication fields; anything else than a boolean or an ISO string is ignored.
  const published = typeof raw.published === 'boolean' ? { published: raw.published } : {}
  const publishedAt = raw.published_at === null || typeof raw.published_at === 'string' ? { published_at: raw.published_at } : {}
  return { ...config, id: Number(raw.id), created_at: raw.created_at, display_url: raw.display_url, ...published, ...publishedAt }
}
export function editable(value: Partial<DisplayLinkFields>): Partial<DisplayLinkFields> {
  return Object.fromEntries(editableFields.filter(key => value[key] !== undefined).map(key => [key, value[key]]))
}
async function decode(response: Response): Promise<unknown> {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  const raw = data && typeof data === 'object' && !Array.isArray(data) ? record(data) : {}
  const errors = raw.errors_by_field
  const fields = errors && typeof errors === 'object' && !Array.isArray(errors) ? record(errors) : {}
  let current: ManagedDisplayLink | undefined
  try { if (raw.display_link) current = managedLink(raw.display_link) } catch { /* Refetch collection for incomplete conflicts. */ }
  throw new ManagementError(response.status, Object.fromEntries(errorFields.flatMap(key =>
    Array.isArray(fields[key]) ? [[key, (fields[key] as unknown[]).filter(x => typeof x === 'string').join('\n')]] : [])), current)
}
export function createManagementApi(request: AuthContextValue['authorizedFetch']) {
  return {
    async list(signal: AbortSignal): Promise<ManagedDisplayLink[]> {
      const data = await decode(await request('/display_links?scope=mine', { signal }))
      const rows = Array.isArray(data) ? data : record(data).display_links
      if (!Array.isArray(rows)) throw new Error(t('links.loadFailed'))
      return rows.map(row => managedLink(record(row).display_link ?? row))
    },
    async revoke(token: string, signal: AbortSignal): Promise<void> {
      await decode(await request(`/display_links/${encodeURIComponent(token)}`, { method: 'DELETE', signal }))
    },
    /**
     * `published` is sent only when the user changed it. Publication does not bump `config_version`, so a
     * publish-only change omits `expected_config_version`: someone else's unrelated edit must not turn it
     * into a stale conflict.
     */
    async save(draft: Partial<DisplayLinkFields>, signal: AbortSignal, baseline?: ManagedDisplayLink, published?: boolean): Promise<ManagedDisplayLink> {
      const fields = editable(draft), publishOnly = published !== undefined && !Object.keys(fields).length
      const data = await decode(await request(baseline ? `/display_links/${encodeURIComponent(baseline.token)}` : '/display_links', {
        method: baseline ? 'PATCH' : 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_link: { ...fields, ...(published === undefined ? {} : { published }) },
          ...(baseline && !publishOnly ? { expected_config_version: baseline.config_version } : {}) }),
      }))
      const result = managedLink(record(data).display_link ?? data)
      if (baseline && (result.token !== baseline.token || result.config_version < baseline.config_version)) throw new Error(t('links.loadFailed'))
      return result
    },
  }
}
