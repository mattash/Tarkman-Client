export interface DisplayLinkConfig {
  token: string
  title?: string
  mode: 'parallel' | 'single'
  lang1: 'translit' | 'en' | 'hyw' | 'grabar'
  lang2?: 'translit' | 'en' | 'hyw' | 'grabar' | null
  show_explanations: boolean
  show_notifications: boolean
  status_view: 'full' | 'pages_only' | 'posture_only' | 'none'
  user_id: number
  church_name?: string
  church_avatar_url?: string | null
}

export type DisplayLanguage = DisplayLinkConfig['lang1']
