import type { KeyValueAdapter } from '@tarkman/core'

// Browsers have no keychain; this matches the existing website, which keeps its token in localStorage.
export const authStore: KeyValueAdapter = {
  async get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  async set(key, value) { localStorage.setItem(key, value) },
  async remove(key) {
    try { localStorage.removeItem(key) } catch { /* Nothing else can be cleared when storage is unavailable. */ }
  },
}
