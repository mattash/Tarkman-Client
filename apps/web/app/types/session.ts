export interface SessionData {
    id: number
    liturgy: string
    liturgy_id?: number
    date: string
    church_name: string
    church_avatar: string
    occupied: boolean
    num_of_parts: number
    current_part_position: number | null
    current_part_id: number | null
    current_liturgy_part_id?: number | null
    revision?: number
    content_context?: string
    cursor?: { part_id: number; liturgy_part_id: number; liturgy_id: number; position: number } | null
    current_liturgy_id?: number
    liturgies?: {
      id: number
      name: string
      position: number
    }[]
    page: number
    posture: string | null
    readings: {
      gospel: string
      epistle: string
    }
    options: {
      gospel: string
      epistle: string
      before_message: string
      after_message: string
    }
    status?: 'active' | 'paused' | 'showing_gospel' | 'showing_epistle' | 'showing_welcome' | 'showing_custom'
    status_message?: string | null
}

export interface SessionWrapper {
    session: SessionData
}

export interface SessionPartResponse {
  status: string
  current_part_id: number
}

export type { Part } from './part'
