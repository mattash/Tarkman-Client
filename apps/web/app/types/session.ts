export interface SessionData {
    id: number
    liturgy: string
    liturgy_id?: number
    date: string
    church_name: string
    church_avatar: string
    occupied: boolean
    num_of_parts: number
    current_part_position: number
    current_part_id: number
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
