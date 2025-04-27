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
  /**
   * Indicates the speed category for the part. Matches the server-side
   * DURATION_TYPES enum and is useful for analytics but should not be relied on
   * for UI timing – prefer `effective_duration_ms` for precise timing.
   */
  duration_type: 'default' | 'very_slow' | 'slow' | 'fast' | 'very_fast' | 'custom'

  /**
   * Estimated time in milliseconds required to perform/read the entire part.
   * This value is used to determine the auto-scroll duration so that the part
   * stays on screen for roughly the required amount of time.
   */
  effective_duration_ms: number
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