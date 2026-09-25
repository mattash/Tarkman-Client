import { expect, it } from '@jest/globals'
import { normalizeExplanations } from '../features/live/contracts'
import { acknowledgeExplanations, explanationItems, explanationOwnerKey, newExplanationCount, readerScopeKey, sameExplanationBatch, type ExplanationBatch } from '../features/live/explanationCue'
import { formatMessage } from '../features/i18n/messages'
import { en } from '../features/i18n/catalogs/en'
import { ru } from '../features/i18n/catalogs/ru'

const normalize = (rows: object[]) => normalizeExplanations({ explanations: rows.map(explanation => ({ explanation })) })
const items = (rows: object[]) => explanationItems(normalize(rows))!
const token = {}
const batch = (rows: object[], ownerKey = explanationOwnerKey(7, 'lp:11')): ExplanationBatch => ({ readerScopeKey: 'scope', readerInstanceToken: token, ownerKey, requestId: 1, items: items(rows) })
it('counts unique current authored versions, not revisions or array order', () => {
  const initial = [{ id: 1, title: 'Title', description: 'Body' }, { id: 2, title: 'Second' }], first = batch(initial)
  expect(newExplanationCount(new Map(), first.ownerKey, first.items)).toBe(2)
  const history = acknowledgeExplanations(new Map(), first)
  expect(newExplanationCount(history, first.ownerKey, items([...initial].reverse()))).toBe(0)
  expect(newExplanationCount(history, first.ownerKey, items([initial[0], initial[0]]))).toBe(0)
  for (const edited of [{ id: 1, title: 'Edited', description: 'Body' }, { id: 1, title: 'Title', description: 'Edited' }, { id: 3, title: 'Title' }]) {
    expect(newExplanationCount(history, first.ownerKey, items([edited, initial[1]]))).toBe(1)
  }
  expect(newExplanationCount(history, first.ownerKey, [])).toBe(0)
  expect(newExplanationCount(history, first.ownerKey, items([initial[0]]))).toBe(0)
  expect(newExplanationCount(history, explanationOwnerKey(7, 'lp:12'), first.items)).toBe(2)
  expect(newExplanationCount(history, first.ownerKey, first.items)).toBe(0)
})
it('rejects conflicting duplicate IDs and missing live fingerprints without inventing localized identity', () => {
  expect(() => normalize([{ id: 1, title: 'A' }, { id: 1, title: 'B' }])).toThrow()
  expect(() => normalize([{ id: 1, liturgy_part_id: 1 }, { id: 1, liturgy_part_id: 2 }])).toThrow()
  expect(explanationItems([{ id: 1, title: 'Fallback', description: null, liturgyPartId: null }])).toBeNull()
  const a = normalize([{ id: 1 }])[0]
  expect(a.contentFingerprint).toBe('[null,null]')
  expect(explanationItems([a])).toEqual(explanationItems([{ ...a, title: 'Пояснение' }]))
})
it('tickets, scopes, instance tokens and captured fingerprints fence acknowledgment races', () => {
  const a = batch([{ id: 1 }])
  expect(sameExplanationBatch(a, batch([{ id: 1 }]))).toBe(true)
  for (const change of [{ requestId: 2 }, { ownerKey: 'next' }, { readerInstanceToken: {} }, { readerScopeKey: 'other' }, { items: items([{ id: 1, title: 'edit' }]) }]) {
    expect(sameExplanationBatch(a, { ...a, ...change })).toBe(false)
  }
  expect(readerScopeKey({ api: 'https://a', cable: 'wss://a' }, 7)).not.toBe(readerScopeKey({ api: 'https://b', cable: 'wss://a' }, 7))
  expect(readerScopeKey({ api: 'https://a', cable: 'wss://a' }, 7)).not.toBe(readerScopeKey({ api: 'https://a', cable: 'wss://a' }, 8))
})
it('keeps only the last presented fingerprint for each occurrence/item', () => {
  let history = acknowledgeExplanations(new Map(), batch([{ id: 1, title: 'A' }]))
  history = acknowledgeExplanations(history, batch([{ id: 1, title: 'C' }]))
  expect(newExplanationCount(history, batch([]).ownerKey, items([{ id: 1, title: 'B' }]))).toBe(1)
  expect(newExplanationCount(history, batch([]).ownerKey, items([{ id: 1, title: 'C' }]))).toBe(0)
  expect(history.get(batch([]).ownerKey)?.size).toBe(1)
})
it('uses full localized counts including Russian plural categories', () => {
  expect(formatMessage('en', en.reader.explainCurrentPartNew, { count: 1 })).toContain('1 new explanation')
  expect(formatMessage('en', en.reader.explainCurrentPartNew, { count: 12 })).toContain('12 new explanations')
  for (const [count, ending] of [[1, 'новое пояснение'], [2, 'новых пояснения'], [12, 'новых пояснений'], [1.5, 'нового пояснения']] as const) {
    expect(formatMessage('ru', ru.reader.explainCurrentPartNew, { count })).toContain(ending)
  }
})
