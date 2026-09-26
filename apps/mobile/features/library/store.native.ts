import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { byteLength, integer, LibraryError, MAX_BUNDLE_BYTES, MAX_TOTAL_BYTES, parseBundle } from './contracts'
import type { LibraryRepository, SavedItem } from './repository'
/** All database operations share one queue; remove runs after any already-started commit. */
export function createNativeStore(open: () => Promise<SQLiteDatabase> = () => openDatabaseAsync('public-liturgy-library.db')): LibraryRepository {
  let database: Promise<SQLiteDatabase> | undefined
  let tail: Promise<unknown> = Promise.resolve()
  function db() {
    if (!database) database = open().then(async d => {
      const version = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
      if (version && version.user_version > 1) throw new LibraryError('unsupported')
      await d.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS library_items (environment TEXT NOT NULL, id INTEGER NOT NULL, payload TEXT, bytes INTEGER NOT NULL DEFAULT 0, saved_at INTEGER, verified_at INTEGER, PRIMARY KEY(environment,id));
        CREATE TABLE IF NOT EXISTS library_preferences (environment TEXT PRIMARY KEY, dismissed INTEGER NOT NULL);
        PRAGMA user_version = 1;`)
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
      const rows = await d.getAllAsync<{ id: number; payload: string | null; saved_at: number | null; verified_at: number | null }>('SELECT id,payload,saved_at,verified_at FROM library_items WHERE environment=?', environment)
      const items: SavedItem[] = []; let corrupt = 0
      for (const row of rows) {
        try {
          integer(row.id)
          if (row.verified_at !== null) integer(row.verified_at)
          if (row.payload !== null && byteLength(row.payload) > MAX_BUNDLE_BYTES) throw new LibraryError('size')
          const bundle = row.payload === null ? null : parseBundle(JSON.parse(row.payload), row.id)
          if (bundle && (!Number.isSafeInteger(row.saved_at) || row.saved_at! <= 0)) throw new LibraryError('invalid')
          items.push({ id: row.id, bundle, savedAt: row.saved_at, verifiedAt: row.verified_at })
        } catch { corrupt++ /* Isolate, retain for deliberate remove-all recovery. */ }
      }
      const preference = await d.getFirstAsync<{ dismissed: number }>('SELECT dismissed FROM library_preferences WHERE environment=?', environment)
      return { items, dismissed: preference?.dismissed === 1, corrupt }
    }),
    intent: (environment, id) => run(async d => { await d.runAsync('INSERT OR IGNORE INTO library_items(environment,id) VALUES (?,?)', environment, id) }),
    commit: (environment, input, now, valid) => run(async d => {
      const bundle = parseBundle(input), payload = JSON.stringify(bundle), bytes = byteLength(payload)
      await d.withExclusiveTransactionAsync(async tx => {
        const total = await tx.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(bytes),0) AS total FROM library_items WHERE NOT (environment=? AND id=?)', environment, bundle.liturgy.id)
        if ((total?.total ?? 0) + bytes > MAX_TOTAL_BYTES) throw new LibraryError('capacity')
        if (!valid()) throw new LibraryError('cancelled')
        await tx.runAsync('INSERT OR REPLACE INTO library_items(environment,id,payload,bytes,saved_at,verified_at) VALUES (?,?,?,?,?,?)', environment, bundle.liturgy.id, payload, bytes, now, now)
        if (!valid()) throw new LibraryError('cancelled')
      })
    }),
    verify: (environment, id, now) => run(async d => { await d.runAsync('UPDATE library_items SET verified_at=? WHERE environment=? AND id=? AND payload IS NOT NULL', now, environment, id) }),
    remove: (environment, id) => run(async d => {
      if (id === undefined) await d.runAsync('DELETE FROM library_items WHERE environment=?', environment)
      else await d.runAsync('DELETE FROM library_items WHERE environment=? AND id=?', environment, id)
    }),
    dismiss: environment => run(async d => { await d.runAsync('INSERT OR REPLACE INTO library_preferences(environment,dismissed) VALUES (?,1)', environment) }),
  }
}
export const libraryStore = createNativeStore()
