/** Implementations and configuration are supplied by each app. No auth policy is implied. */
export interface TransportRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  headers?: Readonly<Record<string, string>>
  query?: Readonly<Record<string, string | number | boolean>>
  body?: unknown
}
export interface TransportResponse {
  status: number
  headers: Readonly<Record<string, string>>
  data: unknown
}
export interface TransportAdapter {
  request(request: TransportRequest): Promise<TransportResponse>
}
export interface KeyValueAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}
export interface ClockAdapter { nowMs(): number }
export interface TimeZoneAdapter { getTimeZone(): string | null }
export interface SubscriptionIdentifier {
  channel: string
  id?: string | number
  [key: string]: unknown
}
export interface RealtimeAdapter {
  subscribe(identifier: string | SubscriptionIdentifier, receive: (data: unknown) => void): () => void
}
