import { useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { currentPart } from '../live/contracts'
import { useReader } from '../live/useReader'
import type { DisplayLanguage, DisplayPreferences } from './config'
import { DisplayNotice } from './DisplayFrame'
import { PostureIcon } from './PostureIcon'
import { ProjectionText } from './ProjectionText'
import { projectionMessage, projectionText } from './presentation'
import { projectionDuration } from './projectionTiming'
import { useProjectionClock } from './useProjectionClock'

export interface DisplayProjectionProps {
  apiBase: string; cableBase: string; config: DisplayPreferences; sessionId: number
  statusOnly?: boolean; discoveryError?: boolean
}
export function DisplayProjection({ apiBase, cableBase, config, sessionId, statusOnly = false, discoveryError = false }: DisplayProjectionProps) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const { width, height, fontScale } = useWindowDimensions()
  const endpoints = useMemo(() => ({ api: apiBase, cable: cableBase }), [apiBase, cableBase])
  const minimal = statusOnly || config.status_view === 'pages_only' || config.status_view === 'posture_only'
  // Projection reserves the canvas for the reading and speaker; explanations belong in the reader.
  const { state } = useReader(endpoints, sessionId, false)
  const session = state.session
  const part = session ? currentPart(session, state.parts) : undefined
  const padding = Math.max(spacing.md, Math.min(spacing.xl, width / 60))
  const posture = session?.posture ?? part?.posture
  const page = session?.page ?? part?.page
  const message = session ? projectionMessage(session, state.parts, config) : null
  const languages: DisplayLanguage[] = [...new Set(config.mode === 'parallel' && config.lang2 ? [config.lang1, config.lang2] : [config.lang1])]
  const texts = languages.map(language => language === 'hyw' ? null : projectionText(part?.text[language]))
  const duration = projectionDuration(part?.effectiveDurationMs, texts)
  const available = !minimal && !discoveryError && !state.error
  const readingClock = useProjectionClock(`${sessionId}/${part?.key}`, available && !!part && !message && session?.status === 'active')
  const messageText = message?.body ?? message?.title ?? null
  const messageClock = useProjectionClock(`${sessionId}/${part?.key}/${message?.title}/${messageText}`, available && !!message)

  if (!session) return <DisplayNotice testID={state.error ? 'display-projection-unavailable' : 'display-projection-loading'}
    busy={!state.error} title={t(state.error ? 'display.projectionUnavailable' : 'display.loading')}
    detail={state.error ? t('display.retrying') : undefined} />
  // A failure must also be readable from a distance. Keep the snapshot and live reader mounted
  // behind this notice so successful discovery/polling can restore the projection automatically.
  if (discoveryError || state.error) return <DisplayNotice testID="display-connection"
    title={t(discoveryError ? 'display.discoveryUnavailable' : 'readerStatus.updatesUnavailable')}
    detail={t('display.retrying')} />

  if (minimal) {
    const showPage = config.status_view !== 'posture_only', showPosture = config.status_view !== 'pages_only'
    const compact = height > width || width / fontScale < 700
    const both = showPage && showPosture
    const pageWidth = (width - padding * 2) * (both && !compact ? 0.65 : 1)
    const itemHeight = (height - padding * 2) / (both && compact ? 2 : 1)
    const pageText = page != null && page > 0 ? String(page) : '—'
    const numberSize = Math.min(itemHeight * 0.85, pageWidth / (pageText.length * 0.65)) / fontScale
    return <View testID="display-status" style={[styles.screen, { padding }]}>
      <View style={[styles.statusContent, { flexDirection: compact ? 'column' : 'row' }]}>
        {showPage && <View style={[styles.statusItem, { flex: both && !compact ? 0.65 : 1 }]}>
          <AppText testID="display-page" style={{ fontSize: numberSize, lineHeight: numberSize * 1.1, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] }}>{pageText}</AppText>
        </View>}
        {showPosture && <View style={[styles.statusItem, { flex: both && !compact ? 0.35 : 1 }]}>
          <PostureIcon posture={posture} />
        </View>}
      </View>
    </View>
  }

  const stacked = width / fontScale < 640
  const fontSize = Math.max(32, Math.min(width / (languages.length > 1 ? 26 : 20), height / (stacked && languages.length > 1 ? 18 : 10)))
  const roleSize = Math.max(24, fontSize * 0.6)
  return <View testID="display-projection" style={[styles.screen, { padding, gap: spacing.md }]}>
    {message ? <ProjectionText key={`${message.title}/${message.body}`} text={messageText} fontSize={fontSize * 1.2} centered
      clock={messageClock} durationMs={projectionDuration(null, [messageText])} />
      : part ? <>
        {part.role && <AppText testID="display-speaker" style={{ fontSize: roleSize, lineHeight: roleSize * 1.25, fontWeight: '600', textTransform: 'capitalize' }}>{part.role}</AppText>}
        <View testID="display-projection-text" style={[styles.body, { flexDirection: stacked ? 'column' : 'row', gap: padding }]}>
          {languages.map((language, index) => <View key={language} testID={`display-column-${language}`} style={[styles.column,
            index > 0 ? { borderColor: colors.divider, borderLeftWidth: stacked ? 0 : 1, borderTopWidth: stacked ? 1 : 0, paddingLeft: stacked ? 0 : padding, paddingTop: stacked ? spacing.md : 0 } : undefined]}>
            <ProjectionText key={`${session.id}/${part.key}/${language}`} text={texts[index]}
              language={language === 'hyw' ? 'en' : language} fontSize={fontSize} clock={readingClock} durationMs={duration} />
          </View>)}
        </View>
      </> : <DisplayNotice title={t('display.waitingForPart')} />}
  </View>
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 }, body: { flex: 1, minHeight: 0 }, column: { flex: 1, minWidth: 0, minHeight: 0 },
  statusContent: { flex: 1, alignItems: 'stretch' },
  statusItem: { minWidth: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
})
