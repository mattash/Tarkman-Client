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
  page: number
  explanation_ids: string[]
}

export interface PartWrapper {
  part: Part
}

export interface SessionPartData {
  session: {
    current_part_id: string
  }
}

export interface UpdateData {
  part: string
}

export interface PartsResponse {
  parts: PartWrapper[]
  sessionData: SessionPartData
}