import type { KeyValueAdapter } from '@tarkman/core'

// expo-sqlite's key-value store is native-only, so browsers keep preferences in localStorage.
export const preferencesStore: KeyValueAdapter = {
  async get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  async set(key, value) { localStorage.setItem(key, value) },
  async remove(key) {
    try { localStorage.removeItem(key) } catch { /* Nothing else can be cleared when storage is unavailable. */ }
  },
}
