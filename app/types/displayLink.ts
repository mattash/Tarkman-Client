export interface DisplayLinkConfig {
  token: string
  mode: 'parallel' | 'single'
  lang1: 'translit' | 'en' | 'hyw'
  lang2?: 'translit' | 'en' | 'hyw' | null
  show_explanations: boolean
  show_notifications: boolean
  status_view: 'full' | 'pages_only' | 'posture_only'
  user_id: number
  church_name?: string
  church_avatar_url?: string | null
}

export type DisplayLanguage = DisplayLinkConfig['lang1']
