export type SessionStatus =
  | 'active'
  | 'paused'
  | 'showing_gospel'
  | 'showing_epistle'
  | 'showing_welcome'
  | 'showing_custom'

export interface StatusUpdateRequest {
  status: SessionStatus
  status_message?: string
  expected_revision?: number
}

export interface StatusUpdateResponse {
  status: string
  current_status: SessionStatus
  status_message?: string | null
  revision?: number
  cursor?: { part_id: number; liturgy_part_id: number; liturgy_id: number; position: number } | null
  content_context?: string
  session_status?: SessionStatus
  posture?: string | null
  date?: string | null
}

export interface StatusChangeEvent {
  status: SessionStatus
  status_message?: string | null
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  showing_gospel: 'Gospel Reading',
  showing_epistle: 'Epistle Reading',
  showing_welcome: 'Welcome Message',
  showing_custom: 'Custom Announcement'
}

export const STATUS_COLORS: Record<SessionStatus, string> = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  showing_gospel: 'bg-purple-500',
  showing_epistle: 'bg-blue-500',
  showing_welcome: 'bg-teal-500',
  showing_custom: 'bg-orange-500'
}
