/** Open inbound API/realtime vocabulary, including live and future statuses. */
export type SessionStatus = string

/** Closed values supported by status commands and the existing UI labels. */
export type KnownSessionStatus =
  | 'active'
  | 'paused'
  | 'showing_gospel'
  | 'showing_epistle'
  | 'showing_prophetic'
  | 'showing_welcome'
  | 'showing_custom'
  | 'showing_session_qr'

export interface StatusUpdateRequest {
  status: KnownSessionStatus
  status_message?: string
}

export interface StatusUpdateResponse {
  status: string
  current_status: SessionStatus
  status_message?: string | null
}

export interface StatusChangeEvent {
  status: SessionStatus
  status_message?: string | null
}

export const STATUS_LABELS: Record<KnownSessionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  showing_gospel: 'Gospel Reading',
  showing_epistle: 'Epistle Reading',
  showing_prophetic: 'Prophetic Reading',
  showing_welcome: 'Welcome Message',
  showing_custom: 'Custom Announcement',
  showing_session_qr: 'Read-along QR'
}
