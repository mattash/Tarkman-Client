import { describe, expect, it } from '@jest/globals'
import { initialState, type LiveSession, type ReaderState } from '@tarkman/reader'
import { freshness } from '../src/freshness'
import { canGoBack, currentRoute, initialNavigation, navigate } from '../src/navigation'

const session = { id: 7, title: 'Divine Liturgy', church: 'St. John', status: 'active', message: null } as LiveSession
const ready: ReaderState = { ...initialState, loading: false, stale: false, connected: true, listed: true, session, following: true }

describe('freshness', () => {
  it('claims live only when connected, current, listed, active and error-free', () => {
    expect(freshness(ready, true).kind).toBe('live')
    expect(freshness({ ...initialState }, true).kind).toBe('connecting')
    expect(freshness({ ...ready, connected: false, stale: true }, true).kind).toBe('reconnecting')
    expect(freshness({ ...ready, stale: true }, true).kind).toBe('reconnecting')
    expect(freshness(ready, false).kind).toBe('offline')
    expect(freshness({ ...ready, error: 'Could not refresh' }, true)).toEqual({ kind: 'stale', message: 'Could not refresh' })
    expect(freshness({ ...ready, session: { ...session, status: 'paused', message: 'Back soon' } }, true)).toEqual({ kind: 'status', status: 'paused', message: 'Back soon' })
    expect(freshness({ ...ready, listed: false }, true).kind).toBe('ended')
    expect(freshness({ ...ready, deleted: true, error: 'gone' }, true)).toEqual({ kind: 'unavailable', message: 'gone' })
  })
})

describe('navigation', () => {
  it('goes back one screen, never past the service list, and remembers the last service', () => {
    const reading = navigate(initialNavigation, { type: 'push', route: { name: 'reader', id: 7 } })
    expect(currentRoute(reading)).toEqual({ name: 'reader', id: 7 })
    expect(canGoBack(reading)).toBe(true)
    const back = navigate(reading, { type: 'back' })
    expect(back).toEqual({ stack: [{ name: 'services' }], lastServiceId: 7 })
    expect(canGoBack(back)).toBe(false)
    expect(navigate(back, { type: 'back' })).toBe(back)
  })
})
