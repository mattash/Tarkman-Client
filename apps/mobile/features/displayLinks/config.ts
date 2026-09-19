/**
 * A display-link token resolves to this configuration. Mirrors the backend contract
 * (`GET /display_links/{token}`); a token is a public capability, not user auth.
 */
export type DisplayMode = 'parallel' | 'single'
export type DisplayLanguage = 'translit' | 'en' | 'hyw' | 'grabar'
export type DisplayStatusView = 'full' | 'pages_only' | 'posture_only' | 'none'

export interface DisplayPreferences {
  title?: string
  mode: DisplayMode
  lang1: DisplayLanguage
  lang2?: DisplayLanguage | null
  show_explanations: boolean
  show_notifications: boolean
  status_view: DisplayStatusView
  church_name?: string
  church_avatar_url?: string | null
}

export interface DisplayLinkConfig extends DisplayPreferences {
  token: string
  user_id: number
}

export const DISPLAY_LANGUAGES: readonly DisplayLanguage[] = ['translit', 'en', 'hyw', 'grabar']
export const DISPLAY_MODES: readonly DisplayMode[] = ['parallel', 'single']
export const DISPLAY_STATUS_VIEWS: readonly DisplayStatusView[] = ['full', 'pages_only', 'posture_only', 'none']

export const DEFAULT_DISPLAY_CONFIG: DisplayPreferences = {
  mode: 'parallel',
  lang1: 'translit',
  lang2: 'en',
  show_explanations: false,
  show_notifications: true,
  status_view: 'full',
}

export function isDisplayLanguage(value: unknown): value is DisplayLanguage {
  return typeof value === 'string' && (DISPLAY_LANGUAGES as readonly string[]).includes(value)
}
export function isDisplayMode(value: unknown): value is DisplayMode {
  return typeof value === 'string' && (DISPLAY_MODES as readonly string[]).includes(value)
}
export function isDisplayStatusView(value: unknown): value is DisplayStatusView {
  return typeof value === 'string' && (DISPLAY_STATUS_VIEWS as readonly string[]).includes(value)
}
