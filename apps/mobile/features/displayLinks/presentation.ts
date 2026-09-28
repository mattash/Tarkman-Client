import { positiveId } from '../live/contracts'
import { projectionText } from '@tarkman/reader'
import type { LivePart, LiveSession } from '../live/contracts'
import { t } from '../i18n'
import type { DisplayPreferences } from './config'
import { sessionReaderUrl } from './sessionReaderUrl'

export { projectionText }

export type ProjectionInterrupt =
  | { kind: 'message'; title: string; body: string | null }
  | { kind: 'session_qr'; sessionId: number; url: string }

export function projectionMessage(session: LiveSession, parts: LivePart[], preferences: DisplayPreferences): ProjectionInterrupt | null {
  if (!preferences.show_notifications || preferences.status_view === 'none') return null
  const messages = session.displayMessages
  switch (session.status) {
    case 'paused': return { kind: 'message', title: t('display.paused'), body: projectionText(session.message) }
    case 'showing_gospel': return { kind: 'message', title: t('display.gospel'), body: projectionText(messages?.gospel) }
    case 'showing_epistle': return { kind: 'message', title: t('display.epistle'), body: projectionText(messages?.epistle) }
    case 'showing_welcome': return { kind: 'message', title: t('display.welcome'), body: projectionText(messages?.before) }
    case 'showing_session_qr': return { kind: 'session_qr', sessionId: session.id, url: sessionReaderUrl(session.id) }
    case 'showing_custom': return { kind: 'message', title: t('display.announcement'), body: projectionText(session.message) }
    default: if (session.status !== 'active') return null
  }
  // Current Rails occurrences are one-based; old snapshots used zero. Prefer manifest endpoints
  // so repeated reusable part IDs and a one-part service cannot trigger the wrong boundary.
  const at = parts.findIndex(part => session.currentLiturgyPartId != null ? part.liturgyPartId === session.currentLiturgyPartId
    : part.id === session.currentPartId && part.position === session.currentPosition)
  const first = at === 0 || session.currentPosition === 0 || (!parts.length && session.currentPosition === 1)
  const last = parts.length > 1 ? at === parts.length - 1 : !parts.length && (session.totalParts ?? 0) > 1 && session.currentPosition === session.totalParts
  if (first && projectionText(messages?.before)) return { kind: 'message', title: t('display.welcome'), body: projectionText(messages?.before) }
  if (last && projectionText(messages?.after)) return { kind: 'message', title: t('display.farewell'), body: projectionText(messages?.after) }
  return null
}
export function postureKey(value: string | null | undefined): 'stand' | 'sit' | 'kneel' | null {
  const posture = value?.trim().toLowerCase()
  if (posture === 'stand' || posture === 'standing') return 'stand'
  if (posture === 'sit' || posture === 'sitting') return 'sit'
  if (posture === 'kneel' || posture === 'kneeling') return 'kneel'
  return null
}
export function displayPosture(value: string | null | undefined): string | null {
  const key = postureKey(value)
  return key ? t(`display.${key}`) : null
}

/** Missing status metadata has a presentation default; unsupported instructions stay unknown. */
export function statusPostureKey(value: string | null | undefined): ReturnType<typeof postureKey> {
  return value == null || value.trim() === '' ? 'stand' : postureKey(value)
}
export function statusPageNumber(sessionPage: unknown, partPage: unknown): number | null {
  return positiveId(sessionPage) ?? positiveId(partPage)
}
