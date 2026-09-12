import Storage from 'expo-sqlite/kv-store'
import type { KeyValueAdapter } from '@tarkman/core'

// Reading preferences are not secrets, so they live in the app's own key-value store rather than the keychain.
export const preferencesStore: KeyValueAdapter = {
  get: key => Storage.getItem(key),
  set: (key, value) => Storage.setItem(key, value),
  remove: key => Storage.removeItem(key),
}
