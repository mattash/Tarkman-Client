import type { KeyValueAdapter } from '@tarkman/core'
import { preferencesStore } from '../preferences/storage'
import { buildSavedService, readSavedService, SAVED_SERVICE_KEY, serializeSavedService, type SavedServiceInput, type SavedServiceV1 } from './savedService'

// Include reads in the queue so invalid-record cleanup cannot delete a newer save.
const operations = new WeakMap<KeyValueAdapter, Promise<unknown>>()
function enqueue<T>(store: KeyValueAdapter, operation: () => Promise<T>, fallback: T): Promise<T> {
  const next = (operations.get(store) ?? Promise.resolve()).then(operation).catch(() => fallback)
  operations.set(store, next)
  return next
}

export function loadSavedService(store: KeyValueAdapter = preferencesStore, now: () => number = Date.now): Promise<SavedServiceV1 | null> {
  return enqueue(store, async () => {
    const raw = await store.get(SAVED_SERVICE_KEY)
    const record = readSavedService(raw, now())
    if (!record && raw !== null) await store.remove(SAVED_SERVICE_KEY)
    return record
  }, null)
}

/** Snapshot the entire input before queuing; callers may subsequently replace or mutate their network data. */
export function saveSavedService(input: SavedServiceInput, store: KeyValueAdapter = preferencesStore, now: () => number = Date.now): Promise<void> {
  const record = buildSavedService(input, now())
  const result = record ? serializeSavedService(record) : { invalid: true as const }
  return enqueue(store, async () => {
    if ('json' in result) await store.set(SAVED_SERVICE_KEY, result.json)
    else await store.remove(SAVED_SERVICE_KEY)
  }, undefined)
}

export function clearSavedService(store: KeyValueAdapter = preferencesStore): Promise<void> {
  return enqueue(store, () => store.remove(SAVED_SERVICE_KEY), undefined)
}
