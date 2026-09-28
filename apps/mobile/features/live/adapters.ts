import type { ReaderMessageKey, ReaderObservability, ReaderText } from '@tarkman/reader'
import { benchmarkCable, benchmarkContext, benchmarkHeaders, benchmarkMark, beginRecovery, inheritRecovery, recoveryContext } from '../observability/latencyBenchmark'
import { t, type MessageKey } from '../i18n'

// Binds the shared reader engine to mobile's catalogs and benchmark bridge.
// The assignment fails to compile if the engine asks for copy the catalog does not have.
const readerKeys: (key: ReaderMessageKey) => MessageKey = key => key
export const readerText: ReaderText = key => t(readerKeys(key))

export const readerObservability: ReaderObservability = {
  context: benchmarkContext, mark: benchmarkMark, beginRecovery, inheritRecovery, recoveryContext,
  headers: benchmarkHeaders, cable: benchmarkCable,
}
