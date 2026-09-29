import { currentPart, positiveId, type LivePart, type LiveSession } from '../contracts'
import type { ReaderState } from '../state'
import { projectionText } from '../text'
import type { DisplayLanguage, DisplayPreferences } from './config'
import { customization, projectionLayout, type DisplayCustomization } from './customization'
import { projectionDuration } from './timing'

// The session display's decisions, shared by apps/mobile's display and apps/tv. Each app renders
// the result with its own views; neither may decide differently what a display shows.

export type DisplayMessageKey = 'display.paused' | 'display.gospel' | 'display.epistle' | 'display.welcome'
  | 'display.announcement' | 'display.farewell' | 'display.stand' | 'display.sit' | 'display.kneel'
/** Resolved at call time, so a host that changes language at runtime is honoured on the next render. */
export type DisplayText = (key: DisplayMessageKey) => string

export type ProjectionInterrupt =
  | { kind: 'message'; title: string; body: string | null }
  | { kind: 'session_qr'; sessionId: number; url: string }

/** Public, credential-free reader destination; never derive it from the API endpoint. */
export function sessionReaderUrl(sessionId: number): string {
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) throw new RangeError('Invalid session ID') // i18n-ignore: programmer error, not interface copy
  return `https://web.tarkman.app/sessions/${sessionId}/parts`
}

export function projectionMessage(session: LiveSession, parts: LivePart[], preferences: DisplayPreferences, t: DisplayText): ProjectionInterrupt | null {
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
export function displayPosture(value: string | null | undefined, t: DisplayText): string | null {
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

/** Reserve both scaled text lines, quiet zone, gaps and screen margins before sizing the matrix. */
export function sessionQrLayout(width: number, height: number, fontScale: number, paddingHorizontal: number, paddingVertical: number, gaps: { md: number; lg: number }) {
  const titleSize = Math.max(28, Math.min(56, width / 18))
  const captionSize = Math.max(18, Math.min(32, width / 32))
  const titleLineHeight = titleSize * 1.3, captionLineHeight = captionSize * 1.3
  const availableHeight = height - paddingVertical * 2 - gaps.lg * 2 - gaps.md - (titleLineHeight + captionLineHeight) * fontScale
  const availableWidth = width - paddingHorizontal * 2
  const space = Math.max(0, Math.min(availableHeight, availableWidth))
  const size = Math.max(0, Math.min(760, space / 1.12, space - 32))
  const quietZone = Math.max(16, size * 0.06)
  return { size, quietZone, titleSize, captionSize, titleLineHeight, captionLineHeight }
}

export interface DisplayInput {
  state: ReaderState; config: DisplayPreferences; sessionId: number
  statusOnly?: boolean; discoveryError?: boolean
  /** The display's own area, in points, and the host's text scale. */
  width: number; height: number; fontScale: number
  /** The host's spacing scale: automatic margins stay between md and xl. */
  spacing: { md: number; xl: number }
  t: DisplayText
}

interface Frame {
  settings: DisplayCustomization
  layout: ReturnType<typeof projectionLayout>
  /** Automatic margin, also the gap between parallel columns. */
  padding: number
  /** The current occurrence; the projection clock and manual scroll reset only when it changes. */
  occurrence: string
}
export type DisplayView = Frame & (
  | { kind: 'deleted' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'connection'; discovery: boolean }
  | { kind: 'session_qr'; message: Extract<ProjectionInterrupt, { kind: 'session_qr' }> }
  | { kind: 'status'; showPage: boolean; showPosture: boolean; page: number | null; posture: string | null }
  | {
    kind: 'projection'
    message: Extract<ProjectionInterrupt, { kind: 'message' }> | null
    /** The message text, or its title when it has no body. */
    messageText: string | null
    part: LivePart | undefined
    languages: DisplayLanguage[]
    texts: Array<string | null>
    durationMs: number
    fontSize: number; roleSize: number
    /** Narrow displays put parallel languages above each other instead of side by side. */
    stacked: boolean
    showExplanationCue: boolean
    readingRunning: boolean; messageRunning: boolean
  })

/** The current occurrence; a display's clock and manual scroll reset only when this changes. */
export function displayOccurrence(state: Pick<ReaderState, 'session' | 'parts'>, sessionId: number): string {
  return `${sessionId}/${state.session ? currentPart(state.session, state.parts)?.key : undefined}`
}

/** What the session display shows for this state, configuration and size. Order matters. */
export function describeDisplay({ state, config, sessionId, statusOnly = false, discoveryError = false, width, height, fontScale, spacing, t }: DisplayInput): DisplayView {
  const settings = customization(config)
  const minimal = statusOnly || config.status_view === 'pages_only' || config.status_view === 'posture_only'
  const session = state.session
  const part = session ? currentPart(session, state.parts) : undefined
  const padding = Math.max(spacing.md, Math.min(spacing.xl, width / 60))
  const layout = projectionLayout(settings, width, height, padding)
  const frame: Frame = { settings, layout, padding, occurrence: displayOccurrence(state, sessionId) }

  // A deleted named session is final here; an owner-current link's discovery replaces this projection on its own.
  if (state.deleted) return { ...frame, kind: 'deleted' }
  if (!session) return { ...frame, kind: state.error ? 'unavailable' : 'loading' }
  // A failure must also be readable from a distance. The snapshot and live reader stay mounted
  // behind this notice so successful discovery/polling can restore the projection automatically.
  if (discoveryError || state.error) return { ...frame, kind: 'connection', discovery: discoveryError }

  const message = projectionMessage(session, state.parts, config, t)
  if (message?.kind === 'session_qr' && !minimal) return { ...frame, kind: 'session_qr', message }
  if (minimal) {
    return { ...frame, kind: 'status', showPage: config.status_view !== 'posture_only', showPosture: config.status_view !== 'pages_only',
      page: statusPageNumber(session.page, part?.page), posture: session.posture?.trim() || part?.posture?.trim() || null }
  }
  const languages: DisplayLanguage[] = [...new Set(config.mode === 'parallel' && config.lang2 ? [config.lang1, config.lang2] : [config.lang1])]
  const texts = languages.map(language => language === 'hyw' ? null : projectionText(part?.text[language]))
  const stacked = width / fontScale < 640
  const fontSize = Math.max(32, Math.min(width / (languages.length > 1 ? 26 : 20), height / (stacked && languages.length > 1 ? 18 : 10))) * layout.textScale
  const textMessage = message?.kind === 'message' ? message : null
  return {
    ...frame, kind: 'projection', message: textMessage, messageText: textMessage ? textMessage.body ?? textMessage.title : null,
    part, languages, texts, durationMs: projectionDuration(part?.effectiveDurationMs, texts),
    fontSize, roleSize: Math.max(24, fontSize * 0.6), stacked,
    showExplanationCue: config.show_explanations && !state.stale && !state.explanationError && state.explanations.length > 0,
    readingRunning: !!part && !textMessage && session.status === 'active',
    messageRunning: !!textMessage,
  }
}
