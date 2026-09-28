import { createReaderApi, type ReaderApi } from '@tarkman/reader'
import { readerObservability, readerText } from './adapters'

export { isSessionNotFound } from '@tarkman/reader'
export type { ReaderApi } from '@tarkman/reader'
export function createApi(base: string, request: typeof fetch = fetch): ReaderApi {
  return createReaderApi({ base, request, text: readerText, observability: readerObservability })
}
