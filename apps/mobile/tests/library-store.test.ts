import { it, expect, jest } from '@jest/globals'
import { DatabaseSync } from 'node:sqlite'
import { createLibrary } from '../features/library/downloadCoordinator'
import { deferred, ticks } from './library-test-helpers'
import type { Bundle } from '../features/library/contracts'
import type { SQLiteDatabase } from 'expo-sqlite'
import { createNativeStore } from '../features/library/store.native'
import { libraryStore as web } from '../features/library/store.web'
import fixture from './fixtures/public_liturgies/bundle.json'
import changed from './fixtures/public_liturgies/bundle_updated.json'
import { MAX_TOTAL_BYTES, parseBundle } from '../features/library/contracts'
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) => jest.requireActual<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(value).digest('hex'),
}))
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
  d.db.exec('PRAGMA user_version = 3')
  await expect(createNativeStore(d.open).hydrate('a')).rejects.toMatchObject({ code: 'unsupported' })
  d.db.close()
})
it('web cannot claim durable persistence', async () => {
  expect(web.durable).toBe(false)
  expect((await web.hydrate('web')).items).toEqual([])
  await expect(web.commit('web', parseBundle(fixture), 1, () => true)).rejects.toMatchObject({ code: 'unsupported' })
})

it.each<[string, (b: Bundle) => void]>([
  ['text', (b: Bundle) => { b.parts[0].text.en = 'peace' }],
  ['explanation', (b: Bundle) => { b.parts[1].explanations[0].description = 'B synthetic note.' }],
  ['metadata', (b: Bundle) => { b.liturgy.name = 'synthetic service'; b.parts[0].role = 'title' }],
])('quarantines valid-shaped altered %s without trusting its unchanged revision', async (_name, alter) => {
  const d = database(), store = createNativeStore(d.open)
  await store.commit('a', parseBundle(fixture), 1, () => true)
  const altered = parseBundle(fixture); alter(altered)
  expect(parseBundle(altered).revision).toBe(fixture.revision)
  const payload = JSON.stringify(altered)
  expect(Buffer.byteLength(payload)).toBe(Buffer.byteLength(JSON.stringify(parseBundle(fixture))))
  d.db.prepare('UPDATE library_items SET payload=?,bytes=? WHERE id=701').run(payload, Buffer.byteLength(payload))
  expect(await createNativeStore(d.open).hydrate('a')).toMatchObject({ items: [], corrupt: 1 })
  await expect(store.verify('a', 701, 2)).rejects.toMatchObject({ code: 'invalid' })
  expect(d.db.prepare('SELECT verified_at FROM library_items WHERE id=701').get()?.verified_at).toBe(1)
  await store.commit('a', parseBundle(fixture), 3, () => true)
  expect(await store.hydrate('a')).toMatchObject({ corrupt: 0, items: [{ savedAt: 3 }] })
  d.db.close()
})
it('migrates v1 without trusting legacy payloads and preserves intent, preferences and other environments', async () => {
  const d = database()
  d.db.exec(`CREATE TABLE library_items (environment TEXT NOT NULL, id INTEGER NOT NULL, payload TEXT, bytes INTEGER NOT NULL DEFAULT 0, saved_at INTEGER, verified_at INTEGER, PRIMARY KEY(environment,id));
    CREATE TABLE library_preferences (environment TEXT PRIMARY KEY, dismissed INTEGER NOT NULL);
    INSERT INTO library_preferences VALUES ('a',1);
    INSERT INTO library_items(environment,id) VALUES ('a',702);
    PRAGMA user_version=1;`)
  d.db.prepare('INSERT INTO library_items VALUES (?,?,?,?,?,?)').run('a', 701, JSON.stringify(fixture), 1143, 1, 1)
  d.db.prepare('INSERT INTO library_items VALUES (?,?,?,?,?,?)').run('b', 701, JSON.stringify(fixture), 1143, 1, 1)
  const store = createNativeStore(d.open)
  expect(await store.hydrate('a')).toMatchObject({ corrupt: 1, dismissed: true, items: [{ id: 702, bundle: null }] })
  expect(d.db.prepare('PRAGMA user_version').get()?.user_version).toBe(2)
  await store.commit('a', parseBundle(fixture), 2, () => true)
  expect((await createNativeStore(d.open).hydrate('a')).corrupt).toBe(0)
  expect((await store.hydrate('b')).corrupt).toBe(1)
  await store.remove('a')
  expect((await store.hydrate('a')).dismissed).toBe(true)
  expect(d.db.prepare('SELECT id FROM library_items WHERE environment=?').all('b')).toHaveLength(1)
  d.db.close()
})
it.each([false, true])('rejects 304 after valid-shaped disk corruption and retries only once (second 304: %s)', async second304 => {
  const d = database(), store = createNativeStore(d.open), bundle = parseBundle(fixture)
  await store.commit('a', bundle, 1, () => true)
  const response = deferred<Bundle | null>()
  const api = { catalog: jest.fn<never>(), bundle: jest.fn<(id: number, signal: AbortSignal, revision?: string) => Promise<Bundle | null>>() }
  api.bundle.mockReturnValueOnce(response.promise).mockResolvedValueOnce(second304 ? null : bundle)
  const library = createLibrary('a', api, store, () => 2)
  await library.hydrate()
  const pending = library.request(701, true); await ticks()
  const altered = parseBundle(fixture); altered.parts[1].explanations[0].description = 'Changed on disk'
  const payload = JSON.stringify(altered)
  d.db.prepare('UPDATE library_items SET payload=?,bytes=? WHERE id=701').run(payload, Buffer.byteLength(payload))
  response.resolve(null); await pending
  expect(api.bundle.mock.calls.map(call => call[2])).toEqual([bundle.revision, undefined])
  const disk = await createNativeStore(d.open).hydrate('a')
  if (second304) {
    expect(library.getSnapshot().failures[701]).toBe('invalid')
    expect(disk).toMatchObject({ corrupt: 1, items: [] })
  } else {
    expect(disk).toMatchObject({ corrupt: 0, items: [{ bundle, savedAt: 2 }] })
  }
  d.db.close()
})

it('checks intact checksums on verification without changing the original saved date', async () => {
  const d = database(), store = createNativeStore(d.open)
  await store.commit('a', parseBundle(fixture), 1, () => true)
  const before = d.db.prepare('SELECT integrity FROM library_items').get()?.integrity
  await store.verify('a', 701, 2)
  expect((await store.hydrate('a')).items[0]).toMatchObject({ savedAt: 1, verifiedAt: 2 })
  expect(d.db.prepare('SELECT integrity FROM library_items').get()?.integrity).toBe(before)
  d.db.close()
})
it('rejects a checksum copied across environments and an oversized stored payload', async () => {
  const d = database(), store = createNativeStore(d.open)
  await store.commit('a', parseBundle(fixture), 1, () => true)
  d.db.exec("INSERT INTO library_items SELECT 'b',id,payload,bytes,saved_at,verified_at,integrity FROM library_items WHERE environment='a'")
  expect(await store.hydrate('b')).toMatchObject({ corrupt: 1, items: [] })
  d.db.prepare('UPDATE library_items SET payload=? WHERE environment=?').run('x'.repeat(10 * 1024 * 1024 + 1), 'b')
  expect(await store.hydrate('b')).toMatchObject({ corrupt: 1, items: [] })
  expect((await store.hydrate('a')).items[0].bundle).toEqual(parseBundle(fixture))
  d.db.close()
})
