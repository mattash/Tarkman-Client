export interface DisplayLinkConfig {
  token: string
  title?: string
  mode: 'parallel' | 'single'
  lang1: 'translit' | 'en' | 'hye' | 'hyw' | 'grabar'
  lang2?: 'translit' | 'en' | 'hye' | 'hyw' | 'grabar' | null
  show_explanations: boolean
  show_notifications: boolean
  status_view: 'full' | 'pages_only' | 'posture_only' | 'none'
  device_type?: 'auto' | 'projector' | 'tv' | 'tablet' | 'phone'
  font_scale?: number
  text_movement?: 'continuous' | 'paged' | 'manual' | 'none'
  language_sync?: 'linked' | 'independent'
  margin_percent?: number | null
  config_version?: number
  created_at?: string
  updated_at?: string
  expires_at?: string | null
  display_url?: string
  user_id: number
  church_name?: string
  church_avatar_url?: string | null
}

export type DisplayLanguage = DisplayLinkConfig['lang1']

/** Complete revisioned payload; optional fields above preserve legacy public consumers. */
export interface PublicDisplayLink extends DisplayLinkConfig {
  title: string
  lang2: DisplayLanguage | null
  device_type: NonNullable<DisplayLinkConfig['device_type']>
  font_scale: number
  text_movement: NonNullable<DisplayLinkConfig['text_movement']>
  language_sync: NonNullable<DisplayLinkConfig['language_sync']>
  margin_percent: number | null
  config_version: number
  created_at?: string
  updated_at: string
  expires_at: string | null
  display_url?: string
}
/**
 * Publication is not configuration: it never changes `config_version` and is absent from the public
 * snapshot. Both fields are optional because older backends omit them.
 */
export interface ManagedDisplayLink extends PublicDisplayLink {
  id: number; created_at: string; display_url: string
  published?: boolean; published_at?: string | null
}
export type DisplayLinkFields = Pick<PublicDisplayLink, 'title' | 'mode' | 'lang1' | 'lang2' |
  'device_type' | 'font_scale' | 'text_movement' | 'language_sync' | 'margin_percent' |
  'show_explanations' | 'show_notifications' | 'status_view' | 'expires_at'>
export interface CreateDisplayLinkRequest { display_link: DisplayLinkFields & { published?: boolean } }
export interface UpdateDisplayLinkRequest { display_link: Partial<DisplayLinkFields> & { published?: boolean }; expected_config_version?: number }
export interface DisplayLinkConflict { error: string; display_link?: ManagedDisplayLink; current_config_version?: number }
export interface DisplayLinkValidation { errors: string[]; errors_by_field: Partial<Record<keyof DisplayLinkFields | 'published', string[]>> }
export type DisplayLinkEvent =
  | { event: 'display_link.updated'; data: PublicDisplayLink }
  | { event: 'display_link.invalidated'; data: { token: string; config_version: number; reason: 'deleted' | 'expired' } }
