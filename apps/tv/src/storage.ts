import * as SecureStore from 'expo-secure-store'
import type { KeyValueAdapter } from '@tarkman/core'

/**
 * Durable storage for the saved display. tvOS apps have no persistent Documents directory and the
 * system may purge the Caches directory (where AsyncStorage-style files live), so the choice is kept
 * in the Keychain. Items survive app updates and relaunches; a Keychain can still be lost if the viewer
 * resets the Apple TV or, for a device whose Keychain is not synced, replaces the device.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainService: 'app.tarkman.tv', keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }

export const keychainStore: KeyValueAdapter = {
  get: key => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: key => SecureStore.deleteItemAsync(key, OPTIONS),
}

/** For tests and previews. */
export function memoryStore(initial: Record<string, string> = {}): KeyValueAdapter & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return { data, get: async key => data.get(key) ?? null, set: async (key, value) => { data.set(key, value) }, remove: async key => { data.delete(key) } }
}
