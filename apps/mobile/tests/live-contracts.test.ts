import { describe, expect, it } from '@jest/globals'
import { currentPart, normalizeExplanations, normalizeParts, normalizeServices, normalizeSession, parseEvent } from '../features/live/contracts'
import { validateConfig } from '../features/live/config'
import { initialState, readerReducer } from '../features/live/state'
const session = { session: { id: 7, current_part_id: 2, current_liturgy_id: 20, current_part_position: 1 } }
describe('public Rails boundaries', () => {
  it('accepts array, single, wrapped services and message-only empty response', () => {
    expect(normalizeServices([session, session])).toHaveLength(1)
    expect(normalizeServices(session)[0].id).toBe(7)
    expect(normalizeServices({ sessions: [session] })).toHaveLength(1)
    expect(normalizeServices({ message: 'No services' })).toEqual([])
    expect(() => normalizeServices({ error: 'broken' })).toThrow()
    expect(() => normalizeServices({ sessions: 'bad' })).toThrow()
    expect(() => normalizeServices([{ session: { id: '7' } }])).toThrow()
  })
  it('orders occurrences without deduplicating shared part IDs and resolves by liturgy first', () => {
    const parts = normalizeParts({ parts: [
      { part: { id: 2, liturgy_id: 20, liturgy_part_id: 22, position: 2, en: 'second', ru: null } },
      { part: { id: 2, liturgy_id: 10, liturgy_part_id: 11, position: 1, en: 'first' } },
    ] })
    expect(parts.map(p => p.key)).toEqual(['lp:11', 'lp:22'])
    expect(parts[1].text.ru).toBeNull()
    expect(currentPart(normalizeSession(session), parts)?.key).toBe('lp:22')
    expect(() => normalizeParts({ parts: [{ part: { id: 1, liturgy_part_id: 1 } }, { part: { id: 1, liturgy_part_id: 1 } }] })).toThrow()
    expect(normalizeParts({ parts: [] })).toEqual([])
    expect(() => normalizeParts({ parts: [{}] })).toThrow()
  })
  it('normalizes public explanation wrappers and rejects invalid shapes', () => {
    expect(normalizeExplanations({ explanations: [{ explanation: { id: 4, description: 'Text' } }] })[0].description).toBe('Text')
    expect(() => normalizeExplanations([])).toThrow()
  })
  it.each([
    ['part_change', { session: 7, part: 2, liturgies: [10, 20], liturgy: 20, explanation_ids: [4], has_explanations: true }],
    ['status_change', { session_id: 7, status: 'paused', status_message: null, timestamp: '2026-09-11' }],
    ['explanation_updated', { session_id: 7, explanation_id: 4 }],
  ])('recognizes the actual %s payload', (event, data) => expect(parseEvent({ event, data })).toEqual({ event, sessionId: 7 }))
  it('ignores malformed/unknown events', () => {
    for (const value of [null, { event: 'part_change', data: { session_id: 7 } }, { event: 'other', data: { session_id: 7 } }]) expect(parseEvent(value)).toBeNull()
  })
})
describe('secure explicit configuration', () => {
  it('allows secure endpoints and local development only', () => {
    expect(validateConfig('https://api.example.test', 'wss://api.example.test/cable', false).endpoints).toBeDefined()
    expect(validateConfig('http://192.168.1.3:3000', 'ws://192.168.1.3:3000/cable', true).endpoints).toBeDefined()
  })
  it.each([
    [undefined, undefined, true], ['http://10.example.com', 'ws://10.example.com/cable', true], ['http://localhost:3000', 'ws://localhost:3000/cable', false],
    ['http://example.com', 'ws://example.com/cable', true], ['https://u:p@example.com', 'wss://example.com', false],
    ['https://example.com?token=x', 'wss://example.com', false], ['https://example.com', 'wss://example.com?token=x', false],
    ['https://example.com', 'wss://example.com#secret', false], ['https://example.com\\evil', 'wss://example.com', false],
  ])('fails safely without leaking provided values', (api, cable, development) => {
    const result = validateConfig(api, cable, development)
    expect(result.endpoints).toBeUndefined(); expect(result.error).toContain('not configured')
    expect(result.error).not.toContain('token=x')
  })
})
it('preserves manual reading through authoritative recovery and supports Return to live', () => {
  const manual = readerReducer(initialState, { type: 'manual' })
  const recovered = readerReducer(manual, { type: 'recovered', now: 10, snapshot: { services: [], session: normalizeSession(session), parts: [], explanations: [], explanationError: false, listed: false } })
  expect(recovered.following).toBe(false); expect(recovered.listed).toBe(false)
  expect(readerReducer(recovered, { type: 'follow' }).following).toBe(true)
  expect(readerReducer(recovered, { type: 'failure', message: 'offline' }).session?.id).toBe(7)
})
