import { useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { AppText } from '../../components/AppText'
import { AppIcon } from '../../components/AppIcon'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { currentPart } from '../live/contracts'
import { useReader } from '../live/useReader'
import type { DisplayLanguage, DisplayPreferences } from './config'
import { DisplayNotice } from './DisplayFrame'
import { ProjectionText } from './ProjectionText'
import { displayPosture, projectionMessage, projectionText } from './presentation'

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
  const { state } = useReader(endpoints, sessionId, !minimal && config.show_explanations)
  const session = state.session
  const part = session ? currentPart(session, state.parts) : undefined
  const fontSize = Math.max(28, Math.min(72, width / 32))
  const metaSize = Math.max(16, Math.min(30, width / 70))
  const padding = Math.max(spacing.page, Math.min(64, width / 32))
  const posture = displayPosture(session?.posture ?? part?.posture)
  const page = session?.page ?? part?.page
  const connection = discoveryError ? t('display.discoveryUnavailable') : state.error ? t('readerStatus.updatesUnavailable')
    : !state.connected ? t('common.reconnecting') : null

  if (!session) return <DisplayNotice testID={state.error ? 'display-projection-unavailable' : 'display-projection-loading'}
    busy={!state.error} title={t(state.error ? 'display.projectionUnavailable' : 'display.loading')}
    detail={state.error ? t('display.retrying') : undefined} />

  if (minimal) {
    const showPage = config.status_view !== 'posture_only', showPosture = config.status_view !== 'pages_only'
    const compact = width / fontScale < 700
    const numberSize = Math.max(64, Math.min(width * (showPosture ? 0.23 : 0.4), height * 0.48, 420,
      (width - padding * 2) / (compact || !showPosture ? 1 : 2) / (String(page ?? '—').length * 0.65)))
    const postureSize = Math.max(40, Math.min(width * (showPage ? 0.065 : 0.13), height * 0.18, 160))
    return <View testID="display-status" style={[styles.screen, { padding, gap: spacing.xl }]}>
      <View style={[styles.statusContent, { flexDirection: compact ? 'column' : 'row', gap: padding }]}>
        {showPage && <View style={styles.statusItem}>
          <AppText style={{ fontSize: metaSize, lineHeight: metaSize * 1.5 }} tone="muted">{t('display.hymnalPage')}</AppText>
          <AppText testID="display-page" style={{ fontSize: numberSize, lineHeight: numberSize * 1.1, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] }}>{page && page > 0 ? String(page) : '—'}</AppText>
        </View>}
        {showPosture && <View style={[styles.statusItem, showPage ? { borderColor: colors.divider, borderLeftWidth: compact ? 0 : 1, borderTopWidth: compact ? 1 : 0, paddingTop: compact ? spacing.lg : 0 } : undefined]}>
          <AppText testID="display-posture" variant="title" style={{ fontSize: postureSize, lineHeight: postureSize * 1.25, textAlign: 'center' }}>{posture ?? t('display.postureUnavailable')}</AppText>
        </View>}
      </View>
      {connection && <AppText testID="display-connection" tone="muted" style={{ textAlign: 'center', fontSize: metaSize }}>{connection}</AppText>}
    </View>
  }

  const message = projectionMessage(session, state.parts, config)
  const languages: DisplayLanguage[] = [...new Set(config.mode === 'parallel' && config.lang2 ? [config.lang1, config.lang2] : [config.lang1])]
  const stacked = width / fontScale < 640
  const label = (language: DisplayLanguage) => t(language === 'hyw' ? 'languageNames.hyWest' : `languageNames.${language}`)
  const hasExplanations = config.show_explanations && !state.stale && !state.explanationError && state.explanations.some(explanation =>
    explanation.liturgyPartId == null || explanation.liturgyPartId === part?.liturgyPartId)
  return <View testID="display-projection" style={[styles.screen, { padding, gap: spacing.lg }]}>
    <View testID="display-projection-header" style={[styles.header, { borderBottomColor: colors.divider }]}>
      <AppText style={{ fontSize: metaSize, lineHeight: metaSize * 1.4 }} tone="muted">{session.church || config.church_name}</AppText>
      <AppText style={{ fontSize: metaSize, lineHeight: metaSize * 1.4 }} tone="muted">{session.title}</AppText>
    </View>
    {message ? <View testID="display-message" style={[styles.body, { gap: spacing.lg }]}>
      <AppText variant="title" style={{ fontSize: fontSize * 1.35, lineHeight: fontSize * 1.65, textAlign: 'center' }}>{message.title}</AppText>
      {message.body && <ProjectionText key={`${message.title}/${message.body}`} text={message.body} fontSize={fontSize * 1.2} centered />}
    </View> : part ? <View testID="display-projection-text" style={[styles.body, { flexDirection: stacked ? 'column' : 'row', gap: padding }]}>
      {languages.map((language, index) => <View key={language} testID={`display-column-${language}`} style={[styles.column,
        index > 0 ? { borderColor: colors.divider, borderLeftWidth: stacked ? 0 : 1, borderTopWidth: stacked ? 1 : 0, paddingLeft: stacked ? 0 : padding, paddingTop: stacked ? spacing.md : 0 } : undefined]}>
        <View style={[styles.header, { borderBottomWidth: 0, paddingBottom: spacing.md }]}>
          <AppText tone="muted" style={{ fontSize: metaSize, lineHeight: metaSize * 1.4 }}>{label(language)}</AppText>
          <AppText tone="muted" style={{ fontSize: metaSize, lineHeight: metaSize * 1.4 }}>{part.role}</AppText>
        </View>
        <ProjectionText key={`${session.id}/${part.key}/${language}`} text={language === 'hyw' ? null : projectionText(part.text[language])}
          language={language === 'hyw' ? 'en' : language} fontSize={fontSize} />
      </View>)}
    </View> : <DisplayNotice title={t('display.waitingForPart')} />}
    <View style={[styles.footer, { borderTopColor: colors.divider }]}>
      <View style={styles.footerItems}>
        {config.status_view !== 'none' && page != null && page > 0 && <AppText style={{ fontSize: metaSize, lineHeight: metaSize * 1.5 }} tone="muted">{t('display.page', { page })}</AppText>}
        {config.status_view !== 'none' && posture && <AppText style={{ fontSize: metaSize, lineHeight: metaSize * 1.5 }} tone="muted">{posture}</AppText>}
        {hasExplanations && !message && <View testID="display-explanations" style={styles.footerItems}>
          <AppIcon name="explanation" color={colors.muted} size={metaSize} />
          <AppText tone="muted" style={{ fontSize: metaSize, lineHeight: metaSize * 1.5 }}>{t('display.explanationAvailable')}</AppText>
        </View>}
      </View>
      {connection && <AppText testID="display-connection" tone="muted" style={{ fontSize: metaSize, lineHeight: metaSize * 1.5 }}>{connection}</AppText>}
    </View>
  </View>
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 }, body: { flex: 1, minHeight: 0, justifyContent: 'center' }, column: { flex: 1, minWidth: 0, minHeight: 0 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, paddingBottom: spacing.md },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, paddingTop: spacing.md },
  footerItems: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  statusContent: { flex: 1, alignItems: 'center', justifyContent: 'center' }, statusItem: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
})
