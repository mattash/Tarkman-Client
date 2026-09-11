import type { SessionWrapper } from './session.js'

export interface Part {
  id: number
  liturgy_part_id?: number
  role: string
  grabar: string
  translit: string
  en: string
  ru: string | null
  hy_east: string | null
  hy_west: string | null
  posture: string | null
  sheet_music: string | null
  /** Open API vocabulary, including fixed and future duration types. */
  duration_type: string
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
