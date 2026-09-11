/** Raw records are deliberately not promises of fully validated domain objects.
 * Existing fixtures omit domain fields; status/duration vocabularies remain open.
 */
export interface RawSession extends Record<string, unknown> {
  id: number
  status?: string
}
export interface RawPart extends Record<string, unknown> {
  id: number
  duration_type?: string
}
export interface RawExplanation extends Record<string, unknown> {
  id: number
}
export interface RawSessionWrapper { session: RawSession }
export interface RawPartWrapper { part: RawPart }
export interface RawExplanationWrapper { explanation: RawExplanation }
export interface InactiveCurrentSession { status: 'inactive' }
export type RawCurrentSession = RawSessionWrapper | InactiveCurrentSession
export type RawExplanations = RawExplanation[] | { explanations: RawExplanationWrapper[] }

/** Application envelope delivered by the existing web subscription callback.
 * This does not define native websocket framing or compatibility.
 */
export interface ActionCableEnvelope {
  event: string
  data: Record<string, unknown>
}
export interface RawSessionEventData extends Record<string, unknown> {
  part?: string | number
  status?: string
  status_message?: string | null
}
