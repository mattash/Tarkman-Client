import { displayPosture as sharedDisplayPosture, projectionMessage as sharedProjectionMessage, type DisplayMessageKey,
  type DisplayPreferences, type DisplayText, type LivePart, type LiveSession, type ProjectionInterrupt } from '@tarkman/reader'
import { t, type MessageKey } from '../i18n'

// The display's decisions are shared with apps/tv (packages/tarkman-reader/src/display/presentation.ts).
// This module binds them to mobile's catalogs; the assignment fails to compile if a key is missing.
const displayKey: (key: DisplayMessageKey) => MessageKey = key => key
export const displayText: DisplayText = key => t(displayKey(key))

export { postureKey, projectionText, statusPageNumber, statusPostureKey } from '@tarkman/reader'
export type { ProjectionInterrupt }

export function projectionMessage(session: LiveSession, parts: LivePart[], preferences: DisplayPreferences): ProjectionInterrupt | null {
  return sharedProjectionMessage(session, parts, preferences, displayText)
}
export function displayPosture(value: string | null | undefined): string | null {
  return sharedDisplayPosture(value, displayText)
}
