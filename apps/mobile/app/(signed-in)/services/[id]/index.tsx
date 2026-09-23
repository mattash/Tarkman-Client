import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../../../components/AppButton'
import { AppText } from '../../../../components/AppText'
import { LiturgyText } from '../../../../components/LiturgyText'
import { Notice } from '../../../../components/Notice'
import { capitalized } from '../../../../components/PartHeading'
import { useTheme } from '../../../../design/ThemeProvider'
import { radii, readingSizes, spacing } from '../../../../design/tokens'
import { resolveControlLanguages, usePreferences } from '../../../../features/preferences/PreferencesProvider'
import { ComingUpRow } from '../../../../features/services/ComingUpRow'
import { ControlButton } from '../../../../features/services/ControlButton'
import { ControlConnectionRecovery, ControlConnectionStatus } from '../../../../features/live/ConnectionStatus'
import { OpeningLine } from '../../../../features/services/OpeningLine'
import { STOP_ANNOUNCEMENT, useServiceControl } from '../../../../features/services/ServiceControlProvider'
import { useI18n } from '../../../../features/i18n'

/** One breakpoint: below it (a phone, or an iPad in narrow Split View) the tablet layout collapses to the phone layout exactly. */
const TWO_PANE_WIDTH = 700
const RAIL_WIDTH = 296
const COMING_UP = 6
/** How close to the end of the rail, in points, counts as having scrolled to it. */
const MORE_THRESHOLD = 48
/** How long Go here waits under an upcoming part before the row settles back. */
const ARMED_MS = 8000
/** Narrowest column, in points at the standard 24pt reading size, before columns give way to a stack. */
const MIN_COLUMN = 220
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export default function ServiceControlScreen() {
  const { sessionId, invalid, state, retry, controls, commands, part, index, nextPart, previousPart, offline, announcing, expected,
    run, holds, errorMessage, sheetOpen } = useServiceControl()
  const { colors } = useTheme()
  const { t } = useI18n()
  const { preferences } = usePreferences()
  const { width, fontScale } = useWindowDimensions()
  const reading = useRef<ScrollView>(null)
  const wide = width >= TWO_PANE_WIDTH

  // The operator is the position: a new part replaces the text from its top, however far they had scrolled.
  const partKey = part?.key
  useEffect(() => { reading.current?.scrollTo({ y: 0, animated: false }) }, [partKey])

  // One upcoming part at a time shows Go here. It settles back on its own unless a screen reader is on, whose user needs
  // time to reach the button, and whenever the service moves, since the list it was chosen from has changed.
  const [arming, setArming] = useState<{ key: string; at: string | undefined } | null>(null)
  const armed = arming !== null && arming.at === partKey ? arming.key : null
  const setArmed = (key: string | null) => setArming(key === null ? null : { key, at: partKey })
  // Scrolling to the end of Coming up brings the next few parts into it, so an operator can skip well ahead. All parts are
  // already loaded; this only widens the window, which goes back to its usual size whenever the service moves.
  const [widened, setWidened] = useState<{ count: number; at: string | undefined } | null>(null)
  const shown = widened !== null && widened.at === partKey ? widened.count : COMING_UP
  const upcoming = state.parts.slice(index + 1, index + 1 + shown)
  const hasMore = index + 1 + shown < state.parts.length
  const showMore = () => { if (hasMore) setWidened({ count: shown + COMING_UP, at: partKey }) }
  // Scroll events keep arriving at the end until the new rows are laid out, so the rail widens again only once its
  // content has actually grown since the last time.
  const widenedFrom = useRef<{ height: number; at: string | undefined } | null>(null)

  useEffect(() => {
    if (armed === null) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    void AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then(reading => {
      if (!cancelled && !reading) timer = setTimeout(() => setArming(null), ARMED_MS)
    })
    return () => { cancelled = true; clearTimeout(timer) }
  }, [armed])

  if (invalid) {
    return <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{invalid}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/services')}>{t('common.myServices')}</AppButton>
    </View>
  }

  const sheetCommand = controls.failed !== null && controls.failed !== 'next' && controls.failed !== 'previous'
  const total = state.parts.at(-1)?.position ?? state.parts.length
  // The operator's own languages, in their order. Columns side by side when each keeps a readable measure at the chosen size;
  // otherwise stacked, the first at reading size with the rest beneath it as a 17/27 gloss.
  const languages = resolveControlLanguages(preferences)
  const readingWidth = width - RAIL_WIDTH - 1 - spacing.page * 2 - spacing.lg * (languages.length - 1)
  const columns = wide && languages.length > 1
    && readingWidth / languages.length - spacing.md >= MIN_COLUMN * fontScale * readingSizes[preferences.readingSize].fontSize / 24
  const first = languages[0]

  const header = <View testID="control-header" style={{ minHeight: 56, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
    <AppButton variant="quiet" icon="back" onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/services') } }}>{t('common.myServices')}</AppButton>
    {wide && state.session && <AppText variant="rowTitle" style={{ flexShrink: 1 }}>{state.session.title}</AppText>}
    <View style={{ marginLeft: 'auto', paddingRight: spacing.sm, maxWidth: '100%' }}>
      <ControlConnectionStatus state={state} offline={offline} sending={controls.running !== null} />
    </View>
  </View>

  const text = part && <View testID="control-text" style={{ flexDirection: columns ? 'row' : 'column', gap: spacing.lg }}>
    {/* Columns are unlabelled, as drawn: the rule marks the language read from, and LiturgyText tags each text's language for VoiceOver. */}
    {languages.map(language => <View key={language} testID={`control-text-${language}`}
      style={{ flex: columns ? 1 : undefined, minWidth: 0, gap: spacing.sm,
        paddingLeft: spacing.md - (language === first ? 3 : 1), borderLeftWidth: language === first ? 3 : 1,
        borderLeftColor: language === first ? colors.currentRule : colors.divider }}>
      {columns || language === first
        ? <LiturgyText language={language} text={part.text[language]} readingSize={preferences.readingSize} compactStanzas />
        : <LiturgyText variant="explanation" language={language} text={part.text[language]} compactStanzas />}
    </View>)}
  </View>

  const readingPane = <ScrollView testID="control-reading" ref={reading} style={{ flex: 1 }}
    contentContainerStyle={{ padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.md }}>
    {part ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
        <AppText variant="eyebrow" tone="muted">{t('control.onNow')}</AppText>
        <AppText testID="control-position" variant="eyebrow" accessibilityLabel={t('control.positionLabel', { position: part.position, total })}
          style={{ fontFamily: mono }}>{t('control.position', { position: part.position, total })}</AppText>
      </View>
      {/* On control the role leads and posture follows it, still above the text it applies to. */}
      <View style={{ gap: spacing.xs }}>
        <AppText testID="part-role" accessibilityLabel={capitalized(part.role)} variant={wide ? 'feature' : 'heading'} style={{ textTransform: 'capitalize' }}>{part.role}</AppText>
        {part.posture && <AppText testID="part-posture" accessibilityLabel={`${capitalized(part.posture)}.`} variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{part.posture}</AppText>}
      </View>
      {text}
    </> : state.loading ? <ActivityIndicator accessibilityLabel={t('control.loadingService')} style={{ alignSelf: 'flex-start' }} />
      : <AppText>{state.parts.length === 0 ? t('common.noReadingParts') : t('control.noCurrentPart')}</AppText>}
  </ScrollView>

  const languagesButton = <AppButton variant="quiet" icon="languages" iconOnly={!wide} accessibilityHint={t('control.languagesHint')}
    onPress={() => router.push({ pathname: '/services/[id]/languages', params: { id: String(sessionId) } })}>{t('common.languages')}</AppButton>
  const serviceButton = <AppButton variant="quiet" icon="preferences" accessibilityHint={t('control.serviceHint')}
    onPress={() => router.push({ pathname: '/services/[id]/service', params: { id: String(sessionId) } })}>{t('common.service')}</AppButton>

  // Bands sit between the text and the deck and take their height from the text, so Next and Back never move.
  const bands = <>
    {controls.forbidden ? <Notice tone="danger" accessibilityRole="alert">{t('control.forbidden')}</Notice> : <>
      {offline && <Notice tone="neutral" accessibilityRole="alert">{t('control.offline')}</Notice>}
      {/* Keep recovery beside the controls so its appearance cannot push the current reading down.
          The reading pane already handles initial loading; today's listing is unrelated to control. */}
      {!offline && <ControlConnectionRecovery state={state} retry={retry} />}
      {/* A command refused inside the open sheet reports there, under its control, not on the screen behind. */}
      {controls.error && controls.failure !== 'offline' && !(sheetOpen && sheetCommand) && <Notice tone="danger" accessibilityRole="alert">{errorMessage!}</Notice>}
      {announcing && <View testID="announcement-band" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.action, backgroundColor: colors.warningSurface }}>
        <View accessible style={{ flex: 1, minWidth: 160, gap: 2 }}>
          <AppText variant="eyebrow" style={{ color: colors.warning }}>{t('control.onScreenInstead')}</AppText>
          <AppText variant="label" style={{ color: colors.warning }}>{state.session?.message ?? ''}</AppText>
        </View>
        <ControlButton label={t('control.stop')} accessibilityLabel={t('control.stopLabel')} height={48} labelVariant="label" {...holds(STOP_ANNOUNCEMENT)}
          onPress={() => { void run(STOP_ANNOUNCEMENT, () => commands.setStatus(sessionId, 'active')) }} />
      </View>}
    </>}
  </>

  // A move past either end of the service can never succeed, so the deck never sends it. The control
  // reads as unavailable rather than failed, and the position row already names the end it is at.
  const deckButtons = <View style={{ flexDirection: 'row', gap: 12 }}>
    <ControlButton testID="control-previous" label={t('control.back')} accessibilityLabel={t('control.previousPart')} icon="back" iconOnly={wide} minWidth={96} height={76}
      accessibilityHint={previousPart ? t('control.backHint', { role: capitalized(previousPart.role) }) : t('control.firstPart')} unavailable={!previousPart} {...holds('previous')}
      onPress={() => { void run('previous', () => commands.previous(sessionId, expected)) }} />
    <ControlButton testID="control-next" variant="primary" label={wide ? t('control.next') : t('control.nextPart')} accessibilityLabel={t('control.nextPart')} labelVariant="heading" flex={1} height={76}
      accessibilityHint={nextPart ? t('control.nextHint', { role: capitalized(nextPart.role) }) : t('common.lastPart')} unavailable={!nextPart} {...holds('next')}
      onPress={() => { void run('next', () => commands.next(sessionId, expected)) }} />
  </View>

  return <View style={{ flex: 1 }}>
    {header}
    {wide ? <View style={{ flex: 1, flexDirection: 'row' }}>
      {readingPane}
      <View testID="control-rail" style={{ width: RAIL_WIDTH, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface }}>
        <ScrollView testID="coming-up-list" style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }} scrollEventThrottle={100}
          onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
            if (layoutMeasurement.height + contentOffset.y < contentSize.height - MORE_THRESHOLD) return
            if (widenedFrom.current?.height === contentSize.height && widenedFrom.current.at === partKey) return
            widenedFrom.current = { height: contentSize.height, at: partKey }
            showMore()
          }}>
          <AppText variant="eyebrow" tone="muted">{t('control.comingUp')}</AppText>
          {part && nextPart && !controls.forbidden && <AppText variant="caption" tone="muted">{t('control.tapToJump')}</AppText>}
          {upcoming.map(item => <ComingUpRow key={item.key} item={item} language={first} selected={languages}
            armed={armed === item.key} {...holds(item.key)} readOnly={controls.forbidden}
            onArm={() => setArmed(armed === item.key ? null : item.key)}
            onJump={async () => { if (await run(item.key, () => commands.goToPart(sessionId, item.id, expected, item.liturgyPartId))) setArmed(null) }} />)}
          {/* Also reachable without scrolling: for a screen reader, and when the rail is too short to scroll at all. */}
          {part && hasMore && <View style={{ alignSelf: 'flex-start', marginLeft: -spacing.sm }}>
            <AppButton variant="quiet" onPress={showMore}>{t('control.showMore')}</AppButton>
          </View>}
          {part && !nextPart && <AppText variant="caption" tone="muted">{t('common.lastPart')}</AppText>}
        </ScrollView>
        <View testID="control-deck" style={{ padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
          {!controls.forbidden && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: -spacing.sm }}>{serviceButton}{languagesButton}</View>}
          {bands}
          {!controls.forbidden && deckButtons}
        </View>
      </View>
    </View> : <>
      {readingPane}
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>{bands}</View>
      {!controls.forbidden && <View testID="control-deck" style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm,
        backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View testID="next-up" style={{ flex: 1 }}>
            <AppText variant="caption">{nextPart ? t('control.nextUp', { role: capitalized(nextPart.role) }) : part ? t('common.lastPart') : ''}</AppText>
            {nextPart && <OpeningLine part={nextPart} language={first} selected={languages} numberOfLines={1} />}
          </View>
          <View style={{ flexDirection: 'row', marginRight: -spacing.sm }}>{languagesButton}{serviceButton}</View>
        </View>
        {deckButtons}
      </View>}
    </>}
  </View>
}
