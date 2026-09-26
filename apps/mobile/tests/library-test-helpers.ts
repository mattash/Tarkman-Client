import { LibraryError, parseBundle } from '../features/library/contracts'
import type { LibraryRepository, SavedItem } from '../features/library/repository'
export function memoryStore(): LibraryRepository & { fail: boolean; rows: Map<string, SavedItem> } {
  const rows = new Map<string, SavedItem>(), dismissed = new Set<string>()
  return {
    rows, fail: false, durable: true,
    async hydrate(environment) { return { items: [...rows].filter(([k]) => k.startsWith(`${environment}:`)).map(([, v]) => v), dismissed: dismissed.has(environment), corrupt: 0 } },
    async intent(env, id) { const key = `${env}:${id}`; if (!rows.has(key)) rows.set(key, { id, bundle: null, savedAt: null, verifiedAt: null }) },
    async commit(env, input, now, valid) {
      if (this.fail) throw new LibraryError('storage')
      if (!valid()) throw new LibraryError('cancelled')
      const bundle = parseBundle(input); rows.set(`${env}:${bundle.liturgy.id}`, { id: bundle.liturgy.id, bundle, savedAt: now, verifiedAt: now })
    },
    async verify(env, id, now) { const item = rows.get(`${env}:${id}`); if (item) rows.set(`${env}:${id}`, { ...item, verifiedAt: now }) },
    async remove(env, id) { for (const [key, row] of rows) if (key.startsWith(`${env}:`) && (id === undefined || id === row.id)) rows.delete(key) },
    async dismiss(env) { dismissed.add(env) },
  }
}
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
export async function ticks() { for (let i = 0; i < 20; i++) await Promise.resolve() }
