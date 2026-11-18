import type { KeyValueAdapter } from '@tarkman/core'

/** Unlike optional preference reads, failures must reach the metadata UI (especially deletion). */
export const readingStorage: KeyValueAdapter = {
  async get(key) { return localStorage.getItem(key) },
  async set(key, value) { localStorage.setItem(key, value) },
  async remove(key) { localStorage.removeItem(key) },
}
