import type {
  Part, PartResponse, SessionStatus, SessionData, SessionWrapper,
  StatusChangeEvent, StatusUpdateResponse, StatusUpdateRequest,
  RawPart, RawSession, RawSessionEventData
} from '@tarkman/core'

// Exercise the exported DTOs directly, independently of normalizers/fixtures.
export function inboundStatus(status: string) {
  const sessionStatus: SessionStatus = status
  const event: StatusChangeEvent = { status }
  const response: StatusUpdateResponse = { status, current_status: status }
  const session: SessionData['status'] = status
  const wrapped: SessionWrapper['session']['status'] = status
  const raw: RawSession['status'] = status
  const realtime: RawSessionEventData['status'] = status
  return { sessionStatus, event, response, session, wrapped, raw, realtime }
}
inboundStatus('live')
inboundStatus('future_status')

export function inboundDuration(duration: string) {
  const part: Part['duration_type'] = duration
  const response: PartResponse['part']['duration_type'] = duration
  const raw: RawPart['duration_type'] = duration
  return { part, response, raw }
}
inboundDuration('fixed')
inboundDuration('future_duration')

const command: StatusUpdateRequest = { status: 'active' }
// @ts-expect-error Observed inbound live is not an established command value.
const liveCommand: StatusUpdateRequest = { status: 'live' }
// @ts-expect-error Unknown inbound statuses must not widen outbound commands.
const futureCommand: StatusUpdateRequest = { status: 'future_status' }
void [command, liveCommand, futureCommand]
