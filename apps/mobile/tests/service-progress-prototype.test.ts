import {
  acceptProgress, describeProgress, followProgress, removeProgress,
  PROTOTYPE_MAX_AGE_MS, type ProgressPublication,
} from '../features/serviceProgress/prototype'

const now = 100_000
function publication(overrides: Partial<ProgressPublication> = {}): ProgressPublication {
  return { sessionId: 42, sequence: 1, issuedAt: now, expiresAt: now + PROTOTYPE_MAX_AGE_MS,
    status: 'active', title: 'Public service', contentContext: 'manifest-a', currentOccurrenceId: 12,
    manifest: { complete: true, contentContext: 'manifest-a', occurrences: [
      { id: 11, role: 'priest' }, { id: 12, role: 'choir' }, { id: 13, role: 'priest' },
    ] }, ...overrides }
}
function accepted(overrides: Partial<ProgressPublication> = {}) {
  return acceptProgress(followProgress(42, 'a'), 'a', publication(overrides), now)
}

test('projects a public reader destination, occurrence role and ordinal, without ETA or percentage', () => {
  expect(describeProgress(accepted(), now)).toEqual({
    status: 'active', freshness: 'recent', title: 'Public service',
    url: 'https://web.tarkman.app/sessions/42/parts', updatedAt: now, expiresAt: now + 60_000,
    occurrenceId: 12, role: 'choir', progress: { ordinal: 2, total: 3 },
  })
})

test('expiry occurs at the boundary without any new publication or app action', () => {
  const state = accepted()
  expect(describeProgress(state, now + 59_999).freshness).toBe('recent')
  expect(describeProgress(state, now + 60_000).freshness).toBe('stale')
  expect(describeProgress(state, now + 86_400_000).freshness).toBe('stale')
  expect(describeProgress(state, now - 1).freshness).toBe('stale')
  expect(describeProgress(state, NaN).freshness).toBe('stale')
})

test('replay cannot extend freshness; a new heartbeat sequence can recover', () => {
  const state = accepted()
  const heartbeat = publication({ issuedAt: now + 60_000, expiresAt: now + 120_000 })
  expect(acceptProgress(state, 'a', heartbeat, now + 60_000)).toBe(state)
  const recovered = acceptProgress(state, 'a', { ...heartbeat, sequence: 2 }, now + 60_000)
  expect(describeProgress(recovered, now + 60_000).freshness).toBe('recent')
  expect(acceptProgress(recovered, 'a', publication(), now + 60_000)).toBe(recovered)
})

test.each([
  { sequence: 0 }, { sequence: NaN }, { issuedAt: now + 1 }, { issuedAt: -1 },
  { expiresAt: now }, { expiresAt: Infinity }, { expiresAt: now + 60_001 },
])('rejects invalid sequence/time bounds: %j', overrides => {
  const state = followProgress(42, 'a')
  expect(acceptProgress(state, 'a', publication(overrides), now)).toBe(state)
})

test('rejects backwards publication time even with a newer sequence', () => {
  const state = accepted()
  expect(acceptProgress(state, 'a', publication({ sequence: 2, issuedAt: now - 1 }), now)).toBe(state)
})

test('late snapshots remain stale, not fresh at receipt', () => {
  const state = acceptProgress(followProgress(42, 'a'), 'a', publication(), now + 60_000)
  expect(describeProgress(state, now + 60_000).freshness).toBe('stale')
})

test.each(['ended', 'deleted'] as const)('%s is terminal until a new explicit follow', status => {
  const state = accepted({ status })
  expect(acceptProgress(state, 'a', publication({ sequence: 2 }), now)).toBe(state)
  expect(describeProgress(state, now).progress).toBeNull()
  if (status === 'deleted') {
    expect(describeProgress(state, now)).toMatchObject({ title: null, url: null, role: null })
  }
})

test('a newer deletion refines ended state without reviving the follow or retaining metadata', () => {
  const ended = accepted({ status: 'ended' })
  const deleted = acceptProgress(ended, 'a', publication({ sequence: 2, status: 'deleted' }), now)
  expect(describeProgress(deleted, now)).toMatchObject({ status: 'deleted', title: null, url: null, role: null })
  expect(acceptProgress(deleted, 'a', publication({ sequence: 3, status: 'active' }), now)).toBe(deleted)
})

test('paused and unavailable never collapse into active', () => {
  expect(describeProgress(accepted({ status: 'paused' }), now + 60_000)).toMatchObject({ status: 'paused', freshness: 'stale' })
  expect(describeProgress(accepted({ status: 'unavailable' }), now)).toMatchObject({ status: 'unavailable', progress: null, role: null })
})

test('removal and switching reject queued callbacks, including same-service re-follow', () => {
  const removed = removeProgress(accepted())
  expect(acceptProgress(removed, 'a', publication({ sequence: 2 }), now)).toBe(removed)
  expect(describeProgress(removed, now)).toMatchObject({ status: 'removed', title: null, url: null })
  const switched = followProgress(43, 'b')
  expect(acceptProgress(switched, 'a', publication(), now)).toBe(switched)
  expect(acceptProgress(switched, 'b', publication(), now)).toBe(switched)
  const refollowed = followProgress(42, 'c')
  expect(acceptProgress(refollowed, 'a', publication(), now)).toBe(refollowed)
  expect(describeProgress(refollowed, now).status).toBe('waiting')
})

test.each([
  null,
  { complete: false, contentContext: 'manifest-a', occurrences: [{ id: 12, role: 'choir' }] },
  { complete: true, contentContext: 'old-context', occurrences: [{ id: 12, role: 'choir' }] },
  { complete: true, contentContext: 'manifest-a', occurrences: [] },
  { complete: true, contentContext: 'manifest-a', occurrences: [{ id: 13, role: 'choir' }] },
  { complete: true, contentContext: 'manifest-a', occurrences: [{ id: 12, role: 'a' }, { id: 12, role: 'b' }] },
  { complete: true, contentContext: 'manifest-a', occurrences: [{ id: -1, role: 'a' }, { id: 12, role: 'b' }] },
])('unknown, incomplete, changed or ambiguous manifests suppress progress and role: %j', manifest => {
  expect(describeProgress(accepted({ manifest }), now)).toMatchObject({ occurrenceId: null, progress: null, role: null })
})

test('single part is ordinal 1 of 1, not a claim that the service ended', () => {
  const manifest = { complete: true, contentContext: 'manifest-a', occurrences: [{ id: 12, role: 'choir' }] }
  expect(describeProgress(accepted({ manifest }), now)).toMatchObject({ status: 'active', progress: { ordinal: 1, total: 1 } })
})

test('a new manifest replaces the old order, using occurrence IDs rather than role or position', () => {
  const state = accepted()
  const changed = publication({ sequence: 2, contentContext: 'manifest-b', manifest: {
    complete: true, contentContext: 'manifest-b', occurrences: [{ id: 12, role: 'choir' }, { id: 11, role: 'priest' }],
  } })
  expect(describeProgress(acceptProgress(state, 'a', changed, now), now).progress).toEqual({ ordinal: 1, total: 2 })
})

test('transport mutation cannot rewrite an accepted snapshot', () => {
  const input = publication()
  const state = acceptProgress(followProgress(42, 'a'), 'a', input, now)
  input.title = 'changed'
  input.manifest!.occurrences[1].role = 'changed'
  expect(describeProgress(state, now)).toMatchObject({ title: 'Public service', role: 'choir' })
})

test('invalid service IDs and empty generation are rejected at follow time', () => {
  for (const id of [0, -1, NaN, 1.1]) expect(() => followProgress(id, 'a')).toThrow(RangeError)
  expect(() => followProgress(42, '')).toThrow(RangeError)
})
