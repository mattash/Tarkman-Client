export interface SessionData {
    id: number
    liturgy: string
    date: string
    church_name: string
    avatar_url: string
    occupied: boolean
    num_of_parts: number
    current_part_position: number
    current_part_id: number
    page: number
    posture: any // Adjust the type as needed
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
}

export interface SessionWrapper {
    session: SessionData
} 