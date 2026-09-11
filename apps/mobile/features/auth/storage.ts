import * as SecureStore from 'expo-secure-store'
import type { KeyValueAdapter } from '@tarkman/core'

// Keychain items stay on this device (no iCloud Keychain sync) and are readable only while it is unlocked.
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

export const authStore: KeyValueAdapter = {
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}
