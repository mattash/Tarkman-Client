import type { SessionWrapper } from './session'

export interface Part {
  id: number
  role: string
  grabar: string
  translit: string
  en: string
  ru: string | null
  hy_east: string | null
  hy_west: string | null
  posture: string | null
  sheet_music: string | null
  duration_type: 'default' | 'very_slow' | 'slow' | 'fast' | 'very_fast' | 'custom'
  page: number | null
  explanation_ids: number[]
  effective_duration_ms: number
  position: number
  assignment?: string | null
}

export interface PartWrapper {
  part: Part
}

export interface UpdateData {
  part: string
}

export interface PartsResponse {
  parts: PartWrapper[]
  sessionData: SessionWrapper
}

export interface PartResponse {
  part: Part
}
