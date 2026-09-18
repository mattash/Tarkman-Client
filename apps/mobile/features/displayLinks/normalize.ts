import {
  DEFAULT_DISPLAY_CONFIG,
  isDisplayLanguage,
  isDisplayMode,
  isDisplayStatusView,
  type DisplayLinkConfig,
  type DisplayLanguage,
  type DisplayMode,
  type DisplayStatusView,
} from './config'

export interface DisplayLinkOverrides {
  mode?: DisplayMode
  lang1?: DisplayLanguage
  lang2?: DisplayLanguage | null
  show_explanations?: boolean
  show_notifications?: boolean
  status_view?: DisplayStatusView
}

/**
 * Narrow an arbitrary parsed object into a safe overrides object. Invalid values
 * are dropped so the caller can rely on every present field being valid.
 */
export function normalizeOverrides(value: unknown): DisplayLinkOverrides {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const result: DisplayLinkOverrides = {}
  if (isDisplayMode(raw.mode)) result.mode = raw.mode
  if (isDisplayLanguage(raw.lang1)) result.lang1 = raw.lang1
  if (raw.lang2 === null) result.lang2 = null
  else if (isDisplayLanguage(raw.lang2)) result.lang2 = raw.lang2
  if (typeof raw.show_explanations === 'boolean') result.show_explanations = raw.show_explanations
  if (typeof raw.show_notifications === 'boolean') result.show_notifications = raw.show_notifications
  if (isDisplayStatusView(raw.status_view)) result.status_view = raw.status_view
  return result
}

/** The token's configuration is authoritative; URL parameters can supplement, never override, its preferences. */
export function mergeDisplayConfig(config: DisplayLinkConfig, overrides: DisplayLinkOverrides): DisplayLinkConfig {
  return {
    ...overrides,
    ...config,
    // The authoritative fields can never be overridden.
    token: config.token,
    user_id: config.user_id,
  }
}

/** Apply defaults so every required field is present. */
export function withDefaults(partial: Pick<DisplayLinkConfig, 'token' | 'user_id'> & Partial<DisplayLinkConfig>): DisplayLinkConfig {
  return { ...DEFAULT_DISPLAY_CONFIG, ...partial }
}

/**
 * Narrow an arbitrary parsed response into a DisplayLinkConfig. Returns null only
 * for unrecoverable shapes (missing token or non-integer user_id). Invalid field
 * values silently fall back to defaults so a partially-shaped response still
 * drives a screen instead of an error.
 */
export function normalizeConfig(value: unknown): DisplayLinkConfig | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.token !== 'string' || raw.token === '') return null
  const userId = raw.user_id
  if (typeof userId !== 'number' || !Number.isSafeInteger(userId)) return null
  const partial: Pick<DisplayLinkConfig, 'token' | 'user_id'> & Partial<DisplayLinkConfig> = {
    token: raw.token, user_id: userId,
  }
  if (typeof raw.title === 'string') partial.title = raw.title
  if (isDisplayMode(raw.mode)) partial.mode = raw.mode
  if (isDisplayLanguage(raw.lang1)) partial.lang1 = raw.lang1
  if (raw.lang2 === null) partial.lang2 = null
  else if (isDisplayLanguage(raw.lang2)) partial.lang2 = raw.lang2
  if (typeof raw.show_explanations === 'boolean') partial.show_explanations = raw.show_explanations
  if (typeof raw.show_notifications === 'boolean') partial.show_notifications = raw.show_notifications
  if (isDisplayStatusView(raw.status_view)) partial.status_view = raw.status_view
  if (typeof raw.church_name === 'string') partial.church_name = raw.church_name
  if (raw.church_avatar_url === null) partial.church_avatar_url = null
  else if (typeof raw.church_avatar_url === 'string') partial.church_avatar_url = raw.church_avatar_url
  return withDefaults(partial)
}
