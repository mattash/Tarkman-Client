import type { ReaderState } from '@tarkman/reader'

/**
 * One answer to "can the viewer trust this text as live?". Anything but `live` means the text on
 * screen is not confirmed current, and the reader dims it.
 */
export type Freshness =
  | { kind: 'connecting' }
  | { kind: 'live' }
  | { kind: 'reconnecting' }
  | { kind: 'offline' }
  | { kind: 'stale'; message: string | null }
  | { kind: 'status'; status: string; message: string | null }
  | { kind: 'ended' }
  | { kind: 'unavailable'; message: string | null }

export function freshness(state: ReaderState, online: boolean): Freshness {
  if (state.deleted) return { kind: 'unavailable', message: state.error }
  if (state.loading && !state.session) return { kind: 'connecting' }
  if (!online) return { kind: 'offline' }
  if (state.session && !state.listed) return { kind: 'ended' }
  if (state.error) return { kind: 'stale', message: state.error }
  if (!state.connected || state.stale) return state.session ? { kind: 'reconnecting' } : { kind: 'connecting' }
  if (state.session && state.session.status !== 'active') return { kind: 'status', status: state.session.status, message: state.session.message }
  return { kind: 'live' }
}

/** Following and confirmed live: the only state in which the screen may claim to be live. */
export function isConfirmedLive(value: Freshness): boolean { return value.kind === 'live' }
