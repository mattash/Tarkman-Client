import { expect, jest, test } from '@jest/globals'
import type { KeyValueAdapter } from '@tarkman/core'
import { buildSavedService, readSavedService, validateSavedService, serializeSavedService, serializedBytes,
  SAVED_SERVICE_KEY, SAVED_SERVICE_MAX_BYTES, SAVED_SERVICE_TTL_MS, type SavedServiceV1 } from '../features/offline/savedService'
import { clearSavedService, loadSavedService, saveSavedService } from '../features/offline/savedServiceStore'
import { normalizeSession, normalizeParts, normalizeExplanations } from '../features/live/contracts'

const now = 1_800_000_000_000
const forbidden = { currentPartId: 1, currentLiturgyId: 2, currentPosition: 3, currentRole: 'priest',
  status: 'active', message: 'live', latitude: 40, longitude: 44, connected: true, following: true }
function input() {
  return {
    session: normalizeSession({ session: { id: 1, liturgy: 'Service', church_name: 'Church', date: '2026-09-14' } }),
    parts: normalizeParts({ parts: [1, 2, 3].map(id => ({ part: { id, liturgy_id: 4, liturgy_part_id: id + 10,
      position: id, role: 'priest', en: 'Text', ru: 'Текст', grabar: 'Տէր', translit: 'Ter', posture: 'stand' } })) }),
    explanations: { liturgyPartId: 11, items: normalizeExplanations({ explanations: [
      { explanation: { id: 7, title: 'Title', description: 'Description', liturgy_part_id: 11 } },
    ] }).map(({ id, title, description, liturgyPartId }) => ({ id, title, description, liturgyPartId })) },
  }
}
function record(): SavedServiceV1 { return buildSavedService(input(), now)! }
function adapter(initial: string | null = null) {
  let value = initial
  return {
    get: jest.fn<KeyValueAdapter['get']>(async () => value),
    set: jest.fn(async (_key: string, next: string) => { value = next }),
    remove: jest.fn<KeyValueAdapter['remove']>(async () => { value = null }),
  } satisfies KeyValueAdapter
}
function sized(bytes: number): SavedServiceV1 {
  const value = record()
  value.explanations = null
  value.parts[0].text.en = ''
  value.parts[0].text.en = 'a'.repeat(bytes - Buffer.byteLength(JSON.stringify(value), 'utf8'))
  return value
}

test('T-01: projects only public identity and normalized content at every level', () => {
  const source = input()
  Object.assign(source.session, forbidden)
  source.parts.forEach(part => { Object.assign(part, forbidden); Object.assign(part.text, forbidden) })
  Object.assign(source.explanations, forbidden)
  source.explanations.items.forEach(item => Object.assign(item, forbidden))
  const result = serializeSavedService(buildSavedService(source, now)!)
  expect('json' in result).toBe(true)
  if (!('json' in result)) throw new Error('Expected serialization')
  const parsed = JSON.parse(result.json)
  expect(Object.keys(parsed.session)).toEqual(['id', 'title', 'church', 'date'])
  for (const field of Object.keys(forbidden)) expect(result.json).not.toContain(`"${field}":`)
  expect(readSavedService(JSON.stringify({ ...parsed, ...forbidden, session: { ...parsed.session, ...forbidden } }), now)).toEqual(parsed)
})

test('T-02: round trip preserves every loaded occurrence and explanation, without aliasing', () => {
  const source = input()
  const built = buildSavedService(source, now)!
  expect(readSavedService(JSON.stringify(built), now)).toEqual(built)
  expect(built.parts).toEqual(source.parts)
  expect(built.explanations).toEqual(source.explanations)
  source.parts[0].text.en = 'changed'
  source.explanations.items[0].title = 'changed'
  expect(built.parts[0].text.en).toBe('Text')
  expect(built.explanations!.items[0].title).toBe('Title')
  expect(buildSavedService({ ...source, explanations: undefined }, now)?.explanations).toBeNull()
})

const corrupt = [null, '', '{', 'null', '[]', 'true', '42', '"text"', '{"version":1}',
  ...[undefined, 0, 2, '1'].map(version => JSON.stringify({ ...record(), version })),
  ...[NaN, Infinity, -1, now + 1, 1.5, 'today', undefined].map(savedAt => JSON.stringify({ ...record(), savedAt })),
  ...['x', [], [null], [{ ...record().parts[0], id: undefined }], [record().parts[0], {}],
    [record().parts[0], record().parts[0]]].map(parts => JSON.stringify({ ...record(), parts })),
  ...[null, [], {}, { ...record().session, id: 0 }, { ...record().session, date: 3 }].map(session => JSON.stringify({ ...record(), session })),
  ...[undefined, [], {}, { liturgyPartId: 0, items: [] }, { liturgyPartId: null, items: [null] }].map(explanations => JSON.stringify({ ...record(), explanations })),
]
test.each(corrupt)('T-03/T-04: corrupt record %# is absent and cleaned up', async raw => {
  expect(readSavedService(raw, now)).toBeNull()
  const store = adapter(raw)
  expect(await loadSavedService(store, () => now)).toBeNull()
  expect(store.remove).toHaveBeenCalledTimes(raw === null ? 0 : 1)
  if (raw !== null) expect(store.remove).toHaveBeenCalledWith(SAVED_SERVICE_KEY)
})

test.each(['id', 'key', 'liturgyId', 'liturgyPartId', 'position', 'role', 'posture', 'text'])('T-03: validates part field %s', field => {
  for (const bad of [undefined, {}, [], false, -1]) {
    const value = record()
    Object.assign(value.parts[1], { [field]: bad })
    expect(validateSavedService(value, now)).toBeNull()
  }
})
test.each(['en', 'ru', 'grabar', 'translit'])('T-03: validates text language %s', language => {
  const value = record()
  Object.assign(value.parts[1].text, { [language]: 12 })
  expect(readSavedService(JSON.stringify(value), now)).toBeNull()
})
test.each(['id', 'title', 'description', 'liturgyPartId'])('T-03: validates explanation field %s', field => {
  const value = record()
  Object.assign(value.explanations!.items[0], { [field]: undefined })
  expect(readSavedService(JSON.stringify(value), now)).toBeNull()
})
test.each([-1, 0, 1])('T-04: exact seven-day boundary %d', async offset => {
  const store = adapter(JSON.stringify(record()))
  const loaded = await loadSavedService(store, () => now + SAVED_SERVICE_TTL_MS + offset)
  expect(loaded).toEqual(offset < 0 ? record() : null)
  expect(store.remove).toHaveBeenCalledTimes(offset < 0 ? 0 : 1)
})

test('T-05: exact UTF-8 cap, fallback, and refusal keep every part', async () => {
  const exact = sized(SAVED_SERVICE_MAX_BYTES)
  expect(serializedBytes(JSON.stringify(exact))).toBe(SAVED_SERVICE_MAX_BYTES)
  expect(serializeSavedService(exact)).toEqual({ json: JSON.stringify(exact) })
  exact.explanations = record().explanations
  const fallback = serializeSavedService(exact)
  expect(fallback).toEqual({ dropped: 'explanations', json: JSON.stringify({ ...exact, explanations: null }) })
  const store = adapter('old')
  await saveSavedService(exact, store, () => now)
  expect((await loadSavedService(store, () => now))?.parts).toEqual(exact.parts)
  exact.parts[0].text.en += 'a'
  expect(serializeSavedService(exact)).toEqual({ tooLarge: true })
  await saveSavedService(exact, store, () => now)
  expect(store.set).toHaveBeenCalledTimes(1)
  expect(store.remove).toHaveBeenCalledWith(SAVED_SERVICE_KEY)
  expect(await loadSavedService(store, () => now)).toBeNull()
  expect(readSavedService(JSON.stringify(sized(SAVED_SERVICE_MAX_BYTES + 1)), now)).toBeNull()
})
test('T-05: Unicode bytes and JSON escaping count toward the cap', () => {
  for (const text of ['Տէր', 'Текст', '😀', '\ud800', '\n"\\']) {
    expect(serializedBytes(JSON.stringify(text))).toBe(Buffer.byteLength(JSON.stringify(text), 'utf8'))
  }
  const value = sized(SAVED_SERVICE_MAX_BYTES)
  value.parts[0].text.en = value.parts[0].text.en!.slice(1) + 'Տ'
  expect(serializeSavedService(value)).toEqual({ tooLarge: true })
})
test('invalid input never writes a partial service; clear only touches its own key', async () => {
  const store = adapter('old')
  await saveSavedService({ ...input(), parts: [] }, store, () => now)
  expect(store.set).not.toHaveBeenCalled()
  await clearSavedService(store)
  expect(store.remove.mock.calls).toEqual([[SAVED_SERVICE_KEY], [SAVED_SERVICE_KEY]])
})
test('queued cleanup, replacement and clear respect invocation order and snapshot input', async () => {
  const store = adapter('{')
  const loading = loadSavedService(store, () => now)
  const source = input()
  const saving = saveSavedService(source, store, () => now)
  source.parts.pop()
  await Promise.all([loading, saving])
  expect((await loadSavedService(store, () => now))?.parts).toHaveLength(3)
  await Promise.all([clearSavedService(store), saveSavedService({ ...input(), session: { ...input().session, id: 2 } }, store, () => now)])
  expect((await loadSavedService(store, () => now))?.session.id).toBe(2)
  await Promise.all([saveSavedService(input(), store, () => now), clearSavedService(store)])
  expect(await loadSavedService(store, () => now)).toBeNull()
})
test('adapter exceptions and rejections never interrupt reading or poison the queue', async () => {
  const store = adapter()
  store.get.mockImplementationOnce(() => { throw new Error('unavailable') })
  expect(await loadSavedService(store)).toBeNull()
  store.set.mockRejectedValueOnce(new Error('quota'))
  await expect(saveSavedService(input(), store, () => now)).resolves.toBeUndefined()
  store.remove.mockRejectedValueOnce(new Error('unavailable'))
  await expect(clearSavedService(store)).resolves.toBeUndefined()
  await saveSavedService(input(), store, () => now)
  expect(await loadSavedService(store, () => now)).toEqual(record())
})

test('T-07: preserves last-seen explanations inside the queue and snapshots new content', async () => {
  const store = adapter()
  const latest = input()
  latest.explanations.items[0].title = 'Latest seen'
  const first = saveSavedService(latest, store, () => now)
  const next = { ...input(), explanations: undefined }
  next.parts[0].text.en = 'New reading'
  const preserving = saveSavedService(next, store, () => now + 1)
  next.parts[0].text.en = 'Mutation'
  await Promise.all([first, preserving])
  const saved = await loadSavedService(store, () => now + 1)
  expect(saved?.explanations).toEqual(latest.explanations)
  expect(saved?.parts[0].text.en).toBe('New reading')
  expect(saved?.savedAt).toBe(now + 1)
  await Promise.all([saveSavedService(next, store, () => now + 2), saveSavedService(input(), store, () => now + 3)])
  expect((await loadSavedService(store, () => now + 3))?.explanations).toEqual(input().explanations)
  await Promise.all([saveSavedService(next, store, () => now + 4), clearSavedService(store)])
  expect(await loadSavedService(store, () => now + 4)).toBeNull()
})
test.each(['absent', 'corrupt', 'expired', 'other-session'] as const)('T-07: never preserves explanations from %s records', async kind => {
  const prior = record()
  if (kind === 'other-session') prior.session.id = 2
  const store = adapter(kind === 'absent' ? null : kind === 'corrupt' ? '{' : JSON.stringify(prior))
  const time = kind === 'expired' ? now + SAVED_SERVICE_TTL_MS : now
  await saveSavedService({ ...input(), explanations: undefined }, store, () => time)
  expect((await loadSavedService(store, () => time))?.explanations).toBeNull()
})
test.each([null, { liturgyPartId: 12, items: [] }])('T-07: explicit successful explanation value %j replaces prior text', async explanations => {
  const store = adapter(JSON.stringify(record()))
  await saveSavedService({ ...input(), explanations }, store, () => now)
  expect((await loadSavedService(store, () => now))?.explanations).toEqual(explanations)
})
test('T-07: preservation still applies the size cap and a failed lookup leaves the prior record intact', async () => {
  const store = adapter(JSON.stringify(record()))
  store.get.mockRejectedValueOnce(new Error('unavailable'))
  await expect(saveSavedService({ ...input(), explanations: undefined }, store, () => now)).resolves.toBeUndefined()
  expect(store.set).not.toHaveBeenCalled(); expect(store.remove).not.toHaveBeenCalled()
  await saveSavedService({ ...sized(SAVED_SERVICE_MAX_BYTES), explanations: undefined }, store, () => now)
  expect((await loadSavedService(store, () => now))?.explanations).toBeNull()
})

test('live fingerprints stay local while older saved explanations remain readable', () => {
  const source = input()
  const live = normalizeExplanations({ explanations: [{ explanation: { id: 7, title: 'Title', description: 'Description', liturgy_part_id: 11 } }] })
  expect(live[0].contentFingerprint).toBeDefined()
  const saved = buildSavedService({ ...source, explanations: { liturgyPartId: 11, items: live } }, now)!
  expect(saved.explanations?.items).toEqual(source.explanations.items)
  expect(saved.explanations?.items[0]).not.toHaveProperty('contentFingerprint')
})
