import { validateConfig, type ReaderConfig } from '@tarkman/reader'

export { validateConfig } from '@tarkman/reader'
export type { Endpoints, ReaderConfig } from '@tarkman/reader'
export function readerConfig(): ReaderConfig {
  return validateConfig(process.env.EXPO_PUBLIC_API_URL, process.env.EXPO_PUBLIC_ACTIONCABLE_URL, __DEV__)
}
