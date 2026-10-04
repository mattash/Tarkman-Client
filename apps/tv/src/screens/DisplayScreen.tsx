import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, useTVEventHandler, useWindowDimensions } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { createManualPosition, createPageGroup, describeDisplay, displayOccurrence, independentDuration, projectionDuration,
  sessionQrLayout, statusPostureKey, statusTextScale, type DisplayLanguage, type DisplayPreferences, type Endpoints } from '@tarkman/reader'
import { DisplayOptions } from '../components/DisplayOptions'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { Notice } from '../components/Notice'
import { ProjectionText, type ScrollMetrics } from '../components/ProjectionText'
import { freshness, isConfirmedLive } from '../freshness'
import { useKeepAwakeWhile, useMenuBack, useOnline, useProjectionClock } from '../hooks'
import { displayText, useI18n } from '../i18n'
import { usePreferences } from '../preferences'
import { useReader, type ReaderTransport } from '../reader'
import { colors, space, type } from '../theme'

interface Props {
  endpoints: Endpoints; id: number; onBack(): void; transport?: ReaderTransport
  /** A saved church display's configuration. It replaces this TV's local options, which then do not apply. */
  config?: DisplayPreferences
  /**
   * A saved church display: nothing but the display's own content. No badge, cue, hint or options, and
   * Select does nothing; Menu is handled by the caller (a saved display opens its management screen).
   */
  bare?: boolean
}

/**
 * apps/mobile's session display on Apple TV. What to show comes from the shared describeDisplay; this
 * screen only renders it and adds the remote: Select opens display options, Up/Down scrolls the current
 * reading by hand (until the next reading), Menu closes options or goes back.
 */
export function DisplayScreen({ endpoints, id, onBack, transport, config, bare = false }: Props) {
  const { t } = useI18n()
  const online = useOnline()
  const { display: localDisplay } = usePreferences()
  const display = config ?? localDisplay
  const { state } = useReader(endpoints, id, transport, { loadExplanations: !bare && !!config?.show_explanations })
  const { width, height, fontScale } = useWindowDimensions()
  const view = describeDisplay({ state, config: display, sessionId: id, width, height, fontScale, spacing: space, t: displayText })
  const occurrence = displayOccurrence(state, id)
  const fresh = freshness(state, online)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const closeOptions = useCallback(() => setOptionsOpen(false), [])
  useMenuBack(optionsOpen, closeOptions)

  // Remote scrolling makes this occurrence manual; the next reading returns to the configured movement.
  const [scrolledOccurrence, setScrolledOccurrence] = useState<string | null>(null)
  const scrolling = scrolledOccurrence === occurrence
  const manualPositions = useMemo(() => ({
    occurrence,
    linked: createManualPosition(),
    independent: { en: createManualPosition(), grabar: createManualPosition(), translit: createManualPosition(), hye: createManualPosition(), hyw: createManualPosition() },
  }), [occurrence])
  const pageGroup = useMemo(() => ({ occurrence, ...createPageGroup() }), [occurrence])
  const metrics = useRef(new Map<string, ScrollMetrics>())
  const projection = view.kind === 'projection' ? view : null
  const readingRunning = !!projection?.readingRunning, messageRunning = !!projection?.messageRunning
  const messageKey = `${occurrence}/${projection?.message?.title}/${projection?.messageText}`
  const readingClock = useProjectionClock(occurrence, readingRunning)
  const messageClock = useProjectionClock(messageKey, messageRunning)
  const ongoing = !state.deleted && (!state.session || state.listed)
  useKeepAwakeWhile(ongoing, 'tarkman-display')

  useTVEventHandler(event => {
    if (optionsOpen || !event) return
    if (!bare && (event.eventType === 'select' || event.eventType === 'playPause')) { setOptionsOpen(true); return }
    const direction = event.eventType === 'down' || event.eventType === 'swipeDown' ? 1 : event.eventType === 'up' || event.eventType === 'swipeUp' ? -1 : 0
    if (!direction || !projection?.part || projection.message) return
    const deepest = [...metrics.current.values()].reduce((a, b) => b.maximum > a.maximum ? b : a, { maximum: 0, viewport: 0 })
    if (deepest.maximum <= 0) return
    const positions = [manualPositions.linked, ...Object.values(manualPositions.independent)]
    // Start from where the automatic movement is, then page by most of a screen.
    const from = scrolling ? manualPositions.linked.get() : Math.min(1, readingClock.elapsed() / Math.max(1, projection.durationMs))
    const next = Math.max(0, Math.min(1, from + direction * deepest.viewport * 0.8 / deepest.maximum))
    positions.forEach(position => position.set(next))
    setScrolledOccurrence(occurrence)
  })
  useEffect(() => { metrics.current.clear() }, [occurrence])

  // Session status (paused, gospel, QR) is part of the projection itself, as on mobile. The badge reports
  // only whether the projection is current, so shown text never passes for live when it is not.
  const badge = !bare && !isConfirmedLive(fresh) && fresh.kind !== 'status' && (view.kind === 'projection' || view.kind === 'status' || view.kind === 'session_qr')
  return (
    <View style={styles.canvas}>
      {renderContent()}
      {badge ? <View style={styles.badge}><FreshnessBadge value={fresh} showDetail={false} /></View> : null}
      {!bare && projection?.showExplanationCue ? <View style={styles.cue}><Text testID="display-explanation-cue" style={styles.cueText}>{t('display.explanationAvailable')}</Text></View> : null}
      {!bare && scrolling && !optionsOpen ? <Text testID="display-scroll-hint" style={styles.hint}>{t('display.scrollHint')}</Text>
        : null}
      {optionsOpen ? <DisplayOptions onClose={closeOptions} onBack={onBack} /> : null}
    </View>
  )

  // A render function, not a component: a nested component would remount the projection on every update.
  function renderContent() {
    const { layout, settings, padding } = view
    const screenPadding = { paddingHorizontal: layout.paddingHorizontal, paddingVertical: layout.paddingVertical }
    switch (view.kind) {
      case 'deleted': return <Notice testID="display-session-deleted" title={t('common.serviceNoLongerAvailable')} />
      case 'loading': return <Notice testID="display-projection-loading" busy title={t('display.loading')} />
      case 'unavailable': return <Notice testID="display-projection-unavailable" title={t('display.projectionUnavailable')} detail={t('display.retrying')} />
      case 'connection': return <Notice testID="display-connection" title={t('display.updatesUnavailable')} detail={t('display.retrying')} />
      case 'session_qr': {
        const qr = sessionQrLayout(width, height, fontScale, layout.paddingHorizontal, layout.paddingVertical, space)
        return (
          <View testID="display-session-qr" style={[styles.screen, styles.qrScreen, screenPadding]}>
            <Text style={[styles.white, { fontSize: qr.titleSize, lineHeight: qr.titleLineHeight, fontWeight: '700' }]}>{t('display.scanToReadAlong')}</Text>
            <View style={{ backgroundColor: '#fff', padding: qr.quietZone }} accessible accessibilityRole="image" accessibilityLabel={view.message.url}>
              <QRCode value={view.message.url} size={qr.size} color="#000000" backgroundColor="#ffffff" />
            </View>
            <Text style={[styles.white, { fontSize: qr.captionSize, lineHeight: qr.captionLineHeight }]}>{t('display.readerUrl', { sessionId: view.message.sessionId })}</Text>
          </View>
        )
      }
      case 'status': {
        const { showPage, showPosture, page, posture } = view
        const both = showPage && showPosture
        const pageWidth = (width - layout.paddingHorizontal * 2) * (both ? 0.65 : 1)
        const itemHeight = height - layout.paddingVertical * 2
        const statusScale = statusTextScale(layout.textScale)
        const pageText = page !== null ? String(page) : null
        const numberSize = pageText !== null ? Math.min(itemHeight * 0.85, pageWidth / (pageText.length * 0.65)) / fontScale * statusScale : 0
        const postureKey = statusPostureKey(posture)
        const postureLabel = postureKey ? t(`display.${postureKey}`) : t('display.postureUnavailable')
        const postureSize = Math.max(40, Math.min(width * 0.13, height * 0.18, 160) * statusScale)
        return (
          <View testID="display-status" style={[styles.screen, screenPadding, styles.statusRow]}>
            {showPage ? <View style={[styles.statusItem, { flex: both ? 0.65 : 1 }]}>
              {pageText !== null ? <Text testID="display-page" accessibilityLabel={t('display.page', { page: page! })}
                style={[styles.text, { fontSize: numberSize, lineHeight: numberSize * 1.1, fontVariant: ['tabular-nums'] }]}>{pageText}</Text>
                : <Text testID="display-page-placeholder" style={[styles.muted, { fontSize: type.heading }]}>{t('display.pageUnavailable')}</Text>}
            </View> : null}
            {showPosture ? <View style={[styles.statusItem, { flex: both ? 0.35 : 1 }]}>
              <Text testID="display-posture" style={[styles.text, { fontSize: postureSize, lineHeight: postureSize * 1.25 }]}>{postureLabel}</Text>
            </View> : null}
          </View>
        )
      }
      case 'projection': {
        const { message, messageText, part, languages, texts, durationMs, fontSize, roleSize, stacked } = view
        const movement = scrolling ? 'manual' : settings.text_movement
        if (message) return (
          <View testID="display-projection" style={[styles.screen, screenPadding]}>
            <ProjectionText key={`${message.title}/${message.body}`} text={messageText} fontSize={fontSize * 1.2} centered
              clock={messageClock} durationMs={projectionDuration(null, [messageText])} movement={settings.text_movement} />
          </View>
        )
        if (!part) return <Notice testID="display-waiting-part" title={t('display.waitingForPart')} />
        return (
          <View testID="display-projection" style={[styles.screen, screenPadding, { gap: space.md }]}>
            {part.role ? <Text testID="display-speaker" style={[styles.role, { fontSize: roleSize, lineHeight: roleSize * 1.25 }]}>{part.role}</Text> : null}
            <View testID="display-projection-text" style={[styles.body, { flexDirection: stacked ? 'column' : 'row', gap: padding }]}>
              {languages.map((language: DisplayLanguage, index) => (
                <View key={language} testID={`display-column-${language}`} style={[styles.column, index > 0 ? {
                  borderColor: colors.borderDivider, borderLeftWidth: stacked ? 0 : 1, borderTopWidth: stacked ? 1 : 0,
                  paddingLeft: stacked ? 0 : padding, paddingTop: stacked ? space.md : 0 } : undefined]}>
                  <ProjectionText key={`${id}/${part.key}/${language}`} text={texts[index]} language={language === 'hyw' || language === 'hye' ? 'grabar' : language} fontSize={fontSize} clock={readingClock}
                    durationMs={settings.language_sync === 'independent' ? independentDuration(durationMs, texts[index], texts) : durationMs}
                    movement={movement} pageGroup={settings.language_sync === 'linked' ? pageGroup : undefined}
                    manualPosition={settings.language_sync === 'linked' ? manualPositions.linked : manualPositions.independent[language]}
                    onMetrics={value => metrics.current.set(language, value)} />
                </View>
              ))}
            </View>
          </View>
        )
      }
    }
  }
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.surfaceCanvas },
  screen: { flex: 1, minHeight: 0 },
  qrScreen: { alignItems: 'center', justifyContent: 'center', gap: space.lg, backgroundColor: '#101010' },
  white: { color: '#fff', textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'stretch' },
  statusItem: { minWidth: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minHeight: 0 },
  column: { flex: 1, minWidth: 0, minHeight: 0 },
  role: { color: colors.textPrimary, fontWeight: '600', textTransform: 'capitalize' },
  text: { color: colors.textPrimary, textAlign: 'center', fontWeight: '600' },
  muted: { color: colors.textSecondary },
  badge: { position: 'absolute', top: space.lg, right: space.xl },
  cue: { position: 'absolute', top: space.lg, left: space.xl, backgroundColor: colors.surfaceRaised, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 12 },
  cueText: { color: colors.textSecondary, fontSize: type.caption },
  hint: { position: 'absolute', bottom: space.lg, alignSelf: 'center', color: colors.textSecondary, fontSize: type.caption, backgroundColor: colors.surfaceRaised, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 12, overflow: 'hidden' },
})
