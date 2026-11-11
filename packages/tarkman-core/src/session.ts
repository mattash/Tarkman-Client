import type { SessionStatus } from './status.js'

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
    current_liturgy_part_id?: number | null
    revision?: number
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
      prophetic?: string | null
    }
    options: {
      gospel: string
      epistle: string
      prophetic?: string | null
      before_message: string
      after_message: string
    }
    status?: SessionStatus
    status_message?: string | null
}

export interface SessionWrapper {
    session: SessionData
}

export interface SessionPartResponse {
  status: string
  current_part_id: number
}

export type { Part } from './part.js'
