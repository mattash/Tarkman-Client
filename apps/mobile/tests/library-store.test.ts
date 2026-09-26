import { it, expect, jest } from '@jest/globals'
import { DatabaseSync } from 'node:sqlite'
import type { SQLiteDatabase } from 'expo-sqlite'
import { createNativeStore } from '../features/library/store.native'
import { libraryStore as web } from '../features/library/store.web'
import fixture from './fixtures/public_liturgies/bundle.json'
import changed from './fixtures/public_liturgies/bundle_updated.json'
import { MAX_TOTAL_BYTES, parseBundle } from '../features/library/contracts'
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
/** Real SQLite engine behind the Expo async interface; device bridge/cold-start remains external QA. */
function database() {
  const db = new DatabaseSync(':memory:')
  let failWrite = false
  const adapter = {
    async execAsync(sql: string) { db.exec(sql) },
    async getFirstAsync(sql: string, ...params: (string | number)[]) { return db.prepare(sql).get(...params) ?? null },
    async getAllAsync(sql: string, ...params: (string | number)[]) { return db.prepare(sql).all(...params) },
    async runAsync(sql: string, ...params: (string | number)[]) { if (failWrite) throw new Error('disk-full'); return db.prepare(sql).run(...params) },
    async withExclusiveTransactionAsync(task: (tx: unknown) => Promise<void>) {
      db.exec('BEGIN IMMEDIATE')
      try { await task(adapter); db.exec('COMMIT') } catch (error) { db.exec('ROLLBACK'); throw error }
    },
  }
  return { db, open: async () => adapter as unknown as SQLiteDatabase, fail() { failWrite = true } }
}
it('initializes once; rehydration preserves text beyond seven days and separates environments/dismissal', async () => {
  const d = database(), store = createNativeStore(d.open), bundle = parseBundle(fixture)
  await store.commit('a', bundle, 1, () => true); await store.dismiss('a')
  const restarted = createNativeStore(d.open)
  expect((await restarted.hydrate('a')).items[0]).toMatchObject({ bundle, savedAt: 1 })
  expect((await restarted.hydrate('a')).dismissed).toBe(true)
  expect((await restarted.hydrate('b')).items).toEqual([])
  await restarted.remove('a'); expect((await restarted.hydrate('a')).dismissed).toBe(true)
  d.db.close()
})
it('failed replacement and cancelled transaction roll back to the old complete snapshot', async () => {
  const d = database(), store = createNativeStore(d.open), old = parseBundle(fixture), next = parseBundle(changed)
  await store.commit('a', old, 1, () => true)
  let calls = 0
  await expect(store.commit('a', next, 2, () => ++calls < 2)).rejects.toMatchObject({ code: 'cancelled' })
  expect((await store.hydrate('a')).items[0].bundle).toEqual(old)
  d.fail(); await expect(store.commit('a', next, 3, () => true)).rejects.toMatchObject({ code: 'storage' })
  expect((await store.hydrate('a')).items[0].bundle).toEqual(old)
  d.db.close()
})
it('isolates corrupt records, projects unknown fields, and never removes unrelated downloads', async () => {
  const d = database(), store = createNativeStore(d.open)
  await store.commit('a', { ...fixture, secret: 'private' } as never, 1, () => true)
  d.db.prepare('INSERT INTO library_items(environment,id,payload,bytes) VALUES (?,?,?,?)').run('a', 999, '{broken', 7)
  expect((await store.hydrate('a')).corrupt).toBe(1)
  expect((await store.hydrate('a')).items).toHaveLength(1)
  const raw = d.db.prepare('SELECT payload FROM library_items WHERE id=701').get()!
  expect(raw.payload).not.toContain('private')
  await store.remove('a', 999); expect((await store.hydrate('a')).items).toHaveLength(1)
  d.db.close()
})
it('enforces aggregate cap without eviction and rejects unsupported schema', async () => {
  const d = database(), store = createNativeStore(d.open)
  await store.hydrate('a')
  d.db.prepare('INSERT INTO library_items(environment,id,bytes) VALUES (?,?,?)').run('b', 99, MAX_TOTAL_BYTES)
  await expect(store.commit('a', parseBundle(fixture), 1, () => true)).rejects.toMatchObject({ code: 'capacity' })
  expect(d.db.prepare('SELECT id FROM library_items WHERE environment=?').all('b')).toHaveLength(1)
  d.db.exec('PRAGMA user_version = 2')
  await expect(createNativeStore(d.open).hydrate('a')).rejects.toMatchObject({ code: 'unsupported' })
  d.db.close()
})
it('web cannot claim durable persistence', async () => {
  expect(web.durable).toBe(false)
  expect((await web.hydrate('web')).items).toEqual([])
  await expect(web.commit('web', parseBundle(fixture), 1, () => true)).rejects.toMatchObject({ code: 'unsupported' })
})
