import { createContracts } from '@tarkman/reader'
import { readerText } from './adapters'

// Read models live in @tarkman/reader; these are mobile's localized normalizers.
export { currentPart, parseEvent, parsePublication, positiveId, sessionWithState } from '@tarkman/reader'
export type { DisplayMessages, LiveExplanation, LivePart, LiveSession, SessionCursor, SessionEvent, SessionState } from '@tarkman/reader'
export const { record, requiredId, normalizeSession, normalizeServices, normalizeParts, normalizeExplanations, normalizeState } = createContracts(readerText)
