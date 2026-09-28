import { createReaderController as createEngine, type Lifecycle, type ReaderCache } from '@tarkman/reader'
import type { ReaderApi } from './api'
import type { CableClient } from './cable'
import { readerObservability, readerText } from './adapters'

export type { Lifecycle, ReaderCache } from '@tarkman/reader'
/** Mobile's reader: the shared engine with mobile copy and the latency benchmark bridge. */
export function createReaderController(api: ReaderApi, cable: CableClient, cableUrl: string, lifecycle: Lifecycle, id: number | null, cache?: ReaderCache, loadExplanations = true) {
  return createEngine({ api, cable, cableUrl, lifecycle, id, cache, loadExplanations, text: readerText, observability: readerObservability })
}
