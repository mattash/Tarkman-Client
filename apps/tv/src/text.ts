import type { ReaderMessageKey } from '@tarkman/reader'

// English copy for the engine's messages. The Record type fails to compile when the engine adds a key.
// Copied from apps/mobile's English catalog; a translated TV interface arrives with the live reader (#214).
const messages: Record<ReaderMessageKey, string> = {
  'common.serviceNoLongerAvailable': 'This service is no longer available.',
  'errors.duplicatePart': 'Duplicate part occurrence.',
  'errors.loadService': 'Could not load the service. Please retry.',
  'errors.missingIdentifier': 'Missing response identifier.',
  'errors.noNetwork': 'No network connection. Reading will refresh when you reconnect.',
  'errors.refreshService': 'Could not refresh the service. Check your connection and retry.',
  'errors.unexpectedExplanations': 'Unexpected explanations response.',
  'errors.unexpectedFormat': 'Unexpected response format.',
  'errors.unexpectedParts': 'Unexpected parts response.',
  'errors.unexpectedServices': 'Unexpected services response.',
  'errors.unexpectedSession': 'Unexpected session response.',
  'fallbacks.churchService': 'Church service',
  'fallbacks.explanation': 'Explanation',
  'fallbacks.reading': 'Reading',
  'fallbacks.service': 'Service',
}

export const readerText = (key: ReaderMessageKey): string => messages[key]
