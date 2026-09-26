import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto'
import { byteLength, integer, LibraryError, MAX_BUNDLE_BYTES, MAX_TOTAL_BYTES, parseBundle } from './contracts'
import type { LibraryRepository, SavedItem } from './repository'
interface StoredRow { id: number; payload: string | null; integrity: string | null; bytes: number; saved_at: number | null; verified_at: number | null }
const selectRow = 'SELECT id,CASE WHEN length(CAST(payload AS BLOB)) <= ? THEN payload WHEN payload IS NULL THEN NULL ELSE \'\' END AS payload,integrity,bytes,saved_at,verified_at FROM library_items WHERE environment=? AND id=?'
// Local corruption detection, not server authenticity. No content/digest leaves SQLite.
function digest(environment: string, row: Pick<StoredRow, 'id' | 'payload' | 'bytes' | 'saved_at'>) {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify(['library-v2', environment, row.id, row.bytes, row.saved_at, row.payload]))
}
async function readRow(environment: string, row: StoredRow): Promise<SavedItem> {
  integer(row.id)
  if (row.verified_at !== null) integer(row.verified_at)
  if (row.payload === null) {
    if (row.integrity !== null || row.saved_at !== null || row.verified_at !== null || row.bytes !== 0) throw new LibraryError('invalid')
    return { id: row.id, bundle: null, savedAt: null, verifiedAt: null }
  }
  if (row.payload.length > MAX_BUNDLE_BYTES || byteLength(row.payload) > MAX_BUNDLE_BYTES) throw new LibraryError('size')
  integer(row.saved_at)
  if (row.bytes !== byteLength(row.payload) || !row.integrity || !/^[a-f0-9]{64}$/.test(row.integrity) || await digest(environment, row) !== row.integrity) throw new LibraryError('invalid')
  return { id: row.id, bundle: parseBundle(JSON.parse(row.payload), row.id), savedAt: row.saved_at, verifiedAt: row.verified_at }
}
/** All database operations share one queue; remove runs after any already-started commit. */
export function createNativeStore(open: () => Promise<SQLiteDatabase> = () => openDatabaseAsync('public-liturgy-library.db')): LibraryRepository {
  let database: Promise<SQLiteDatabase> | undefined
  let tail: Promise<unknown> = Promise.resolve()
  function db() {
    if (!database) database = open().then(async d => {
      const version = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
      if (version && version.user_version > 2) throw new LibraryError('unsupported')
      await d.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS library_items (environment TEXT NOT NULL, id INTEGER NOT NULL, payload TEXT, bytes INTEGER NOT NULL DEFAULT 0, saved_at INTEGER, verified_at INTEGER, PRIMARY KEY(environment,id));
        CREATE TABLE IF NOT EXISTS library_preferences (environment TEXT PRIMARY KEY, dismissed INTEGER NOT NULL);`)
      if ((version?.user_version ?? 0) < 2) await d.withExclusiveTransactionAsync(async tx => {
        // Never bless unverified legacy payloads by hashing them during migration.
        await tx.execAsync('ALTER TABLE library_items ADD COLUMN integrity TEXT; PRAGMA user_version = 2;')
      })
      return d
    }).catch(error => { database = undefined; throw error })
    return database
  }
  function run<T>(action: (d: SQLiteDatabase) => Promise<T>): Promise<T> {
    const result = tail.then(async () => action(await db())).catch(error => { throw error instanceof LibraryError ? error : new LibraryError('storage') })
    tail = result.catch(() => undefined); return result
  }
  return {
    durable: true,
    hydrate: environment => run(async d => {
      // Read one bounded payload at a time; never materialize every raw bundle.
      const rows = await d.getAllAsync<{ id: number; size: number }>('SELECT id,COALESCE(length(CAST(payload AS BLOB)),0) AS size FROM library_items WHERE environment=? ORDER BY id', environment)
      const items: SavedItem[] = []; let corrupt = 0, remaining = MAX_TOTAL_BYTES
      for (const row of rows) {
        try {
          if (row.size > MAX_BUNDLE_BYTES || row.size > remaining) throw new LibraryError('size')
          remaining -= row.size
          const stored = await d.getFirstAsync<StoredRow>(selectRow, MAX_BUNDLE_BYTES, environment, row.id)
          if (!stored) throw new LibraryError('invalid')
          items.push(await readRow(environment, stored))
        } catch { corrupt++ /* Isolate, retain for deliberate remove-all recovery. */ }
      }
      const preference = await d.getFirstAsync<{ dismissed: number }>('SELECT dismissed FROM library_preferences WHERE environment=?', environment)
      return { items, dismissed: preference?.dismissed === 1, corrupt }
    }),
    intact: (environment, id) => run(async d => {
      const row = await d.getFirstAsync<StoredRow>(selectRow, MAX_BUNDLE_BYTES, environment, id)
      if (!row) return null
      // Corruption means "no intact copy", as in hydrate; only storage failures propagate.
      try { return (await readRow(environment, row)).bundle } catch { return null }
    }),
    intent: (environment, id) => run(async d => { await d.runAsync('INSERT OR IGNORE INTO library_items(environment,id) VALUES (?,?)', environment, id) }),
    commit: (environment, input, now, valid) => run(async d => {
      const bundle = parseBundle(input), payload = JSON.stringify(bundle), bytes = byteLength(payload)
      const integrity = await digest(environment, { id: bundle.liturgy.id, payload, bytes, saved_at: now })
      await d.withExclusiveTransactionAsync(async tx => {
        const total = await tx.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(bytes),0) AS total FROM library_items WHERE NOT (environment=? AND id=?)', environment, bundle.liturgy.id)
        if ((total?.total ?? 0) + bytes > MAX_TOTAL_BYTES) throw new LibraryError('capacity')
        if (!valid()) throw new LibraryError('cancelled')
        await tx.runAsync('INSERT OR REPLACE INTO library_items(environment,id,payload,bytes,saved_at,verified_at,integrity) VALUES (?,?,?,?,?,?,?)', environment, bundle.liturgy.id, payload, bytes, now, now, integrity)
        if (!valid()) throw new LibraryError('cancelled')
      })
    }),
    verify: (environment, id, now) => run(async d => {
      await d.withExclusiveTransactionAsync(async tx => {
        const row = await tx.getFirstAsync<StoredRow>(selectRow, MAX_BUNDLE_BYTES, environment, id)
        if (!row || !(await readRow(environment, row)).bundle) throw new LibraryError('invalid')
        await tx.runAsync('UPDATE library_items SET verified_at=? WHERE environment=? AND id=?', now, environment, id)
      })
    }),
    remove: (environment, id) => run(async d => {
      if (id === undefined) await d.runAsync('DELETE FROM library_items WHERE environment=?', environment)
      else await d.runAsync('DELETE FROM library_items WHERE environment=? AND id=?', environment, id)
    }),
    dismiss: environment => run(async d => { await d.runAsync('INSERT OR REPLACE INTO library_preferences(environment,dismissed) VALUES (?,1)', environment) }),
  }
}
export const libraryStore = createNativeStore()
