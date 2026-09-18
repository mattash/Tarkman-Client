import { expect, it } from '@jest/globals'
import { readRecentlyControlled, recordRecentlyControlled, recentlyControlledKey } from '../features/progress/recentlyControlled'
import { memoryStore } from './auth-helpers'

const entry = { sessionId: 9, title: 'Divine Liturgy', church: 'St. John', date: '2026-09-17' }

it('keeps one row per service, most recent first, capped at three', async () => {
  const { store } = memoryStore()
  await recordRecentlyControlled(entry, 7, store)
  await recordRecentlyControlled({ ...entry, sessionId: 12, title: 'Morning Service' }, 7, store)
  await recordRecentlyControlled(entry, 7, store)
  await recordRecentlyControlled({ ...entry, sessionId: 15, title: 'Vespers' }, 7, store)
  await recordRecentlyControlled({ ...entry, sessionId: 18, title: 'Matins' }, 7, store)
  const services = readRecentlyControlled(await store.get(recentlyControlledKey(7)))
  expect(services.map(service => service.sessionId)).toEqual([18, 15, 9])
})

it('scopes records to the account that made them', async () => {
  const { store } = memoryStore()
  await recordRecentlyControlled(entry, 7, store)
  expect(readRecentlyControlled(await store.get(recentlyControlledKey(8)))).toEqual([])
  expect(readRecentlyControlled(await store.get(recentlyControlledKey(7)))).toHaveLength(1)
})

it('drops malformed storage instead of failing the home screen', () => {
  expect(readRecentlyControlled(null)).toEqual([])
  expect(readRecentlyControlled('not json')).toEqual([])
  expect(readRecentlyControlled('{"sessionId":9}')).toEqual([])
  expect(readRecentlyControlled(JSON.stringify([{ sessionId: -1, title: 'X', church: 'Y' }, { sessionId: 9, title: 'X', church: 'Y' },
    { sessionId: '9', title: 'X', church: 'Y' }]))).toEqual([{ sessionId: 9, title: 'X', church: 'Y', date: null, controlledAt: 0 }])
})

it('never lets a storage failure interrupt opening controls', async () => {
  const failing = { get: async () => { throw new Error('storage down') }, set: async () => {}, remove: async () => {} }
  await expect(recordRecentlyControlled(entry, 7, failing)).resolves.toBeUndefined()
})
