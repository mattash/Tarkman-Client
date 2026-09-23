import type { KeyValueAdapter } from '@tarkman/core'
// Unlike preference defaults, education must distinguish an empty store from a failed read.
export const onboardingStore: KeyValueAdapter = {
  get: async key => localStorage.getItem(key),
  set: async (key, value) => localStorage.setItem(key, value),
  remove: async key => localStorage.removeItem(key),
}
