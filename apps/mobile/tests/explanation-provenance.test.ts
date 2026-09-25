import { expect, it } from '@jest/globals'
import { normalizeSession, normalizeExplanations } from '../features/live/contracts'
import { initialState, readerReducer, type ReaderState } from '../features/live/state'
const items = normalizeExplanations({ explanations: [{ explanation: { id: 1, title: 'A' } }] })
const ready: ReaderState = { ...initialState, loading: false, connected: true, stale: false,
  session: { ...normalizeSession({ session: { id: 7 } }), status: 'active' }, explanations: items,
  explanationProvenance: { ownerKey: 'owner', contextKey: 'context', requestId: 1, status: 'ready' } }
it('retains healthy same-owner non-null-context proof during benign revalidation', () => {
  const refresh = readerReducer(ready, { type: 'refresh' })
  expect(refresh.explanations).toBe(items)
  expect(refresh.explanationProvenance.status).toBe('revalidating')
  expect(refresh.explanationsLoading).toBe(false)
  const start = readerReducer(refresh, { type: 'explanationStart', ownerKey: 'owner', contextKey: 'context', requestId: 3 })
  expect(start.explanations).toBe(items)
  expect(start.explanationProvenance.status).toBe('revalidating')
  const empty = readerReducer(start, { type: 'explanations', ownerKey: 'owner', requestId: 3, explanations: [], failed: false })
  expect(empty.explanations).toEqual([]); expect(empty.explanationProvenance.status).toBe('ready')
})
it.each([{ ownerKey: 'next', contextKey: 'context' }, { ownerKey: 'owner', contextKey: 'changed' }, { ownerKey: 'owner', contextKey: null }])('does not retain a changed or unknown context: %j', proof => {
  const state = readerReducer(ready, { type: 'explanationStart', ...proof, requestId: 2 })
  expect(state.explanations).toEqual([]); expect(state.explanationProvenance.status).toBe('loading')
})
it('rejects old tickets/owners and clears proof on invalidation, failure, disconnect and disable', () => {
  const start = readerReducer(ready, { type: 'explanationStart', ownerKey: 'owner', contextKey: 'context', requestId: 2 })
  for (const result of [{ ownerKey: 'owner', requestId: 1 }, { ownerKey: 'next', requestId: 2 }]) {
    expect(readerReducer(start, { type: 'explanations', ...result, explanations: [], failed: false })).toBe(start)
  }
  for (const action of [{ type: 'stale' }, { type: 'failure', message: 'failed' }, { type: 'connection', connected: false }, { type: 'explanationReset', status: 'idle' }, { type: 'explanationReset', status: 'invalid' }] as const) {
    const cleared = readerReducer(start, action)
    expect(cleared.explanations).toEqual([])
    expect(readerReducer(cleared, { type: 'explanations', ownerKey: 'owner', requestId: 2, explanations: items, failed: false })).toBe(cleared)
  }
  expect(readerReducer(start, { type: 'explanations', ownerKey: 'owner', requestId: 2, explanations: items, failed: true })).toMatchObject({ explanations: [], explanationError: true, explanationProvenance: { status: 'error' } })
})
