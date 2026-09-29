import { useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { StatusPill } from '../../components/StatusPill'
import { AppIcon } from '../../components/AppIcon'
import { useReadingFont } from '../../design/readingFont'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useReader } from '../live/useReader'
import type { DisplayPreferences } from './config'
import { DisplayNotice } from './DisplayFrame'
import { PostureIcon } from './PostureIcon'
import { ProjectionText } from './ProjectionText'
import QRCode from 'react-native-qrcode-svg'
import { describeDisplay, displayOccurrence, sessionQrLayout as sharedSessionQrLayout } from '@tarkman/reader'
import { displayText } from './presentation'
import { projectionDuration } from './projectionTiming'
import { useProjectionClock } from './useProjectionClock'
import { independentDuration, createManualPosition, createPageGroup } from './customization'

/** Reserve both scaled text lines, quiet zone, gaps and screen margins before sizing the matrix. */
export function sessionQrLayout(width: number, height: number, fontScale: number, paddingHorizontal: number, paddingVertical: number) {
  return sharedSessionQrLayout(width, height, fontScale, paddingHorizontal, paddingVertical, spacing)
}

export interface DisplayProjectionProps {
  apiBase: string; cableBase: string; config: DisplayPreferences; sessionId: number
  statusOnly?: boolean; discoveryError?: boolean
}
export function DisplayProjection({ apiBase, cableBase, config, sessionId, statusOnly = false, discoveryError = false }: DisplayProjectionProps) {
  const endpoints = useMemo(() => ({ api: apiBase, cable: cableBase }), [apiBase, cableBase])
  const { state } = useReader(endpoints, sessionId, config.show_explanations)
  return <DisplayPresentation state={state} config={config} sessionId={sessionId} statusOnly={statusOnly} discoveryError={discoveryError} />
}

/** Also used by the setup preview with synthetic data; no requests or service mutations. */
export function DisplayPresentation({ state, config, sessionId, statusOnly = false, discoveryError = false, preview = false }: {
  state: ReturnType<typeof useReader>['state']; config: DisplayPreferences; sessionId: number
  statusOnly?: boolean; discoveryError?: boolean; preview?: boolean
}) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const { width, height, fontScale } = useWindowDimensions()
  // What to show is decided once for mobile and apps/tv; this component only renders it.
  const view = describeDisplay({ state, config, sessionId, statusOnly, discoveryError, width, height, fontScale, spacing, t: displayText })
  const { settings, layout, padding } = view
  const occurrence = displayOccurrence(state, sessionId)
  const screenPadding = { paddingHorizontal: layout.paddingHorizontal, paddingVertical: layout.paddingVertical }
  const manualPositions = useMemo(() => ({
    occurrence,
    linked: createManualPosition(),
    independent: { en: createManualPosition(), grabar: createManualPosition(), translit: createManualPosition(), hyw: createManualPosition() },
  }), [occurrence])
  const pageGroup = useMemo(() => ({ occurrence, ...createPageGroup() }), [occurrence])
  const projection = view.kind === 'projection' ? view : null
  const readingRunning = !!projection?.readingRunning, messageRunning = !!projection?.messageRunning
  const messageKey = `${occurrence}/${projection?.message?.title}/${projection?.messageText}`
  const readingClock = useProjectionClock(occurrence, readingRunning)
  const messageClock = useProjectionClock(messageKey, messageRunning)

  if (view.kind === 'deleted') return <DisplayNotice testID="display-session-deleted" title={t('common.serviceNoLongerAvailable')} />
  if (view.kind === 'loading' || view.kind === 'unavailable') return <DisplayNotice testID={view.kind === 'unavailable' ? 'display-projection-unavailable' : 'display-projection-loading'}
    busy={view.kind === 'loading'} title={t(view.kind === 'unavailable' ? 'display.projectionUnavailable' : 'display.loading')}
    detail={view.kind === 'unavailable' ? t('display.retrying') : undefined} />
  if (view.kind === 'connection') return <DisplayNotice testID="display-connection"
    title={t(view.discovery ? 'display.discoveryUnavailable' : 'readerStatus.updatesUnavailable')}
    detail={t('display.retrying')} />

  if (view.kind === 'session_qr') {
    const { message } = view
    const qr = sessionQrLayout(width, height, fontScale, layout.paddingHorizontal, layout.paddingVertical)
    return <View testID="display-session-qr" style={[styles.screen, styles.qrScreen, screenPadding]}>
      <AppText style={{ color: '#fff', fontSize: qr.titleSize, lineHeight: qr.titleLineHeight, textAlign: 'center', fontWeight: '700' }}>{t('display.scanToReadAlong')}</AppText>
      <View style={{ backgroundColor: '#fff', padding: qr.quietZone }} accessible accessibilityRole="image" accessibilityLabel={message.url}>
        <QRCode value={message.url} size={qr.size} color="#000000" backgroundColor="#ffffff" />
      </View>
      <AppText style={{ color: '#fff', fontSize: qr.captionSize, lineHeight: qr.captionLineHeight, textAlign: 'center' }}>{t('display.readerUrl', { sessionId: message.sessionId })}</AppText>
    </View>
  }

  if (view.kind === 'status') {
    const { showPage, showPosture, page, posture } = view
    const compact = height > width || width / fontScale < 700
    const both = showPage && showPosture
    const pageWidth = (width - layout.paddingHorizontal * 2) * (both && !compact ? 0.65 : 1)
    const itemHeight = (height - layout.paddingVertical * 2) / (both && compact ? 2 : 1)
    const pageText = page !== null ? String(page) : null
    const numberSize = pageText !== null ? Math.min(itemHeight * 0.85, pageWidth / (pageText.length * 0.65)) / fontScale : 0
    return <View testID="display-status" style={[styles.screen, screenPadding]}>
      <View style={[styles.statusContent, { flexDirection: compact ? 'column' : 'row' }]}>
        {showPage && <View style={[styles.statusItem, { flex: both && !compact ? 0.65 : 1 }]}>
          {page !== null ? <AppText testID="display-page" accessibilityLabel={t('display.page', { page })} style={{ fontSize: numberSize * Math.min(1, layout.textScale), lineHeight: numberSize * Math.min(1, layout.textScale) * 1.1, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] }}>{pageText}</AppText>
            : <PagePlaceholder width={pageWidth} height={itemHeight} scale={layout.textScale} />}
        </View>}
        {showPosture && <View style={[styles.statusItem, { flex: both && !compact ? 0.35 : 1 }]}>
          <PostureIcon posture={posture} />
        </View>}
      </View>
    </View>
  }

  const { message, messageText, part, languages, texts, durationMs: duration, fontSize, roleSize, stacked, showExplanationCue } = view
  const session = state.session!
  return <View testID="display-projection" style={[styles.screen, screenPadding, { gap: spacing.md }]}>
    {showExplanationCue && <StatusPill label={t('links.explanationAvailable')} tone="info" />}
    {message ? <ProjectionText key={`${message.title}/${message.body}`} text={messageText} fontSize={fontSize * 1.2} centered
      clock={messageClock} durationMs={projectionDuration(null, [messageText])} movement={settings.text_movement} preview={preview} />
      : part ? <>
        {part.role && <AppText testID="display-speaker" style={{ fontSize: roleSize, lineHeight: roleSize * 1.25, fontWeight: '600', textTransform: 'capitalize' }}>{part.role}</AppText>}
        <View testID="display-projection-text" style={[styles.body, { flexDirection: stacked ? 'column' : 'row', gap: padding }]}>
          {languages.map((language, index) => <View key={language} testID={`display-column-${language}`} style={[styles.column,
            index > 0 ? { borderColor: colors.divider, borderLeftWidth: stacked ? 0 : 1, borderTopWidth: stacked ? 1 : 0, paddingLeft: stacked ? 0 : padding, paddingTop: stacked ? spacing.md : 0 } : undefined]}>
            <ProjectionText key={`${session.id}/${part.key}/${language}`} text={texts[index]}
              language={language === 'hyw' ? 'en' : language} fontSize={fontSize} clock={readingClock}
              durationMs={settings.language_sync === 'independent' ? independentDuration(duration, texts[index], texts) : duration}
              movement={settings.text_movement} preview={preview}
              pageGroup={settings.language_sync === 'linked' ? pageGroup : undefined}
              manualPosition={settings.language_sync === 'linked' ? manualPositions.linked : manualPositions.independent[language]} />
          </View>)}
        </View>
      </> : <DisplayNotice title={t('display.waitingForPart')} />}
  </View>
}
/** Keep the page slot intact while the bundled decorative font loads. */
function PagePlaceholder({ width, height, scale }: { width: number; height: number; scale: number }) {
  const ready = useReadingFont()
  const { t } = useI18n()
  const { colors } = useTheme()
  const available = Math.max(0, Math.min(width, height))
  // AppIcon's line height and width each add two points to the glyph size.
  const size = Math.max(0, Math.min(available * 0.35 * Math.min(1, scale), available - 2))
  return <View testID="display-page-placeholder" accessible accessibilityRole="image"
    accessibilityLabel={t('display.pageUnavailable')} style={{ maxWidth: '100%', alignItems: 'center' }}>
    {ready ? <View style={{ opacity: 0.55 }}><AppIcon name="book" color={colors.muted} size={size} /></View>
      : <AppText accessible={false} importantForAccessibility="no" tone="muted" style={{ textAlign: 'center' }}>{t('display.pageUnavailable')}</AppText>}
  </View>
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 }, qrScreen: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, backgroundColor: '#101010' }, body: { flex: 1, minHeight: 0 }, column: { flex: 1, minWidth: 0, minHeight: 0 },
  statusContent: { flex: 1, alignItems: 'stretch' },
  statusItem: { minWidth: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
})
