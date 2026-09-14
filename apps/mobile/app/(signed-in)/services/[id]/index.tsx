import { useEffect, useRef } from 'react'
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../../../components/AppButton'
import { AppText } from '../../../../components/AppText'
import { LiturgyText } from '../../../../components/LiturgyText'
import { Notice } from '../../../../components/Notice'
import { capitalized } from '../../../../components/PartHeading'
import { StatusPill } from '../../../../components/StatusPill'
import { useTheme } from '../../../../design/ThemeProvider'
import { radii, readingSizes, spacing } from '../../../../design/tokens'
import { ReaderStatus } from '../../../../features/live/ReaderStatus'
import { resolveControlLanguages, usePreferences } from '../../../../features/preferences/PreferencesProvider'
import { STATUS_LABELS, statusLabel } from '../../../../features/services/api'
import { ControlButton } from '../../../../features/services/ControlButton'
import { OpeningLine } from '../../../../features/services/OpeningLine'
import { STOP_ANNOUNCEMENT, useServiceControl } from '../../../../features/services/ServiceControlProvider'

/** One breakpoint: below it (a phone, or an iPad in narrow Split View) the tablet layout collapses to the phone layout exactly. */
const TWO_PANE_WIDTH = 700
const RAIL_WIDTH = 296
const COMING_UP = 6
/** Narrowest column, in points at the standard 24pt reading size, before columns give way to a stack. */
const MIN_COLUMN = 220
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export default function ServiceControlScreen() {
  const { sessionId, invalid, state, retry, controls, commands, part, index, nextPart, previousPart, offline, announcing, expected,
    run, holds, errorMessage, sheetOpen } = useServiceControl()
  const { colors } = useTheme()
  const { preferences } = usePreferences()
  const { width, fontScale } = useWindowDimensions()
  const reading = useRef<ScrollView>(null)
  const status = state.session?.status
  const wide = width >= TWO_PANE_WIDTH

  // The operator is the position: a new part replaces the text from its top, however far they had scrolled.
  const partKey = part?.key
  useEffect(() => { reading.current?.scrollTo({ y: 0, animated: false }) }, [partKey])

  if (invalid) {
    return <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{invalid}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/services')}>My services</AppButton>
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
    <AppButton variant="quiet" icon="back" onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/services') } }}>My services</AppButton>
    {wide && state.session && <AppText variant="rowTitle" style={{ flexShrink: 1 }}>{state.session.title}</AppText>}
    {status && <View style={{ marginLeft: 'auto', paddingRight: spacing.sm }}><StatusPill announce={false} {...statusPill(status)} /></View>}
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
    <ReaderStatus state={state} retry={retry} showLive={false} showService={false} />
    {part ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
        <AppText variant="eyebrow" tone="muted">ON NOW</AppText>
        <AppText testID="control-position" variant="eyebrow" accessibilityLabel={`Part ${part.position} of ${total}`}
          style={{ fontFamily: mono }}>{`${part.position} of ${total}`}</AppText>
      </View>
      {/* On control the role leads and posture follows it, still above the text it applies to. */}
      <View style={{ gap: spacing.xs }}>
        <AppText testID="part-role" accessibilityLabel={capitalized(part.role)} variant={wide ? 'feature' : 'heading'} style={{ textTransform: 'capitalize' }}>{part.role}</AppText>
        {part.posture && <AppText testID="part-posture" accessibilityLabel={`${capitalized(part.posture)}.`} variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{part.posture}</AppText>}
      </View>
      {text}
    </> : state.loading ? <ActivityIndicator accessibilityLabel="Loading the service" style={{ alignSelf: 'flex-start' }} />
      : <AppText>{state.parts.length === 0 ? 'No reading parts are available for this service.' : 'No current part'}</AppText>}
  </ScrollView>

  const languagesButton = <AppButton variant="quiet" icon="languages" iconOnly={!wide} accessibilityHint="Which languages service control shows, and in what order."
    onPress={() => router.push({ pathname: '/services/[id]/languages', params: { id: String(sessionId) } })}>Languages</AppButton>
  const serviceButton = <AppButton variant="quiet" icon="preferences" accessibilityHint="Status, announcements and jumping to a part."
    onPress={() => router.push({ pathname: '/services/[id]/service', params: { id: String(sessionId) } })}>Service</AppButton>

  // Bands sit between the text and the deck and take their height from the text, so Next and Back never move.
  const bands = <>
    {controls.forbidden ? <Notice tone="danger" accessibilityRole="alert">You do not have permission to control this service.</Notice> : <>
      {offline && <Notice tone="neutral" accessibilityRole="alert">You are offline. Reconnect before changing the service.</Notice>}
      {/* A command refused inside the open sheet reports there, under its control, not on the screen behind. */}
      {controls.error && controls.failure !== 'offline' && !(sheetOpen && sheetCommand) && <Notice tone="danger" accessibilityRole="alert">{errorMessage!}</Notice>}
      {announcing && <View testID="announcement-band" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.action, backgroundColor: colors.warningSurface }}>
        <View accessible style={{ flex: 1, minWidth: 160, gap: 2 }}>
          <AppText variant="eyebrow" style={{ color: colors.warning }}>ON THE SCREEN INSTEAD</AppText>
          <AppText variant="label" style={{ color: colors.warning }}>{state.session?.message ?? ''}</AppText>
        </View>
        <ControlButton label="Stop" accessibilityLabel="Stop showing the announcement" height={48} labelVariant="label" {...holds(STOP_ANNOUNCEMENT)}
          onPress={() => { void run(STOP_ANNOUNCEMENT, () => commands.setStatus(sessionId, 'active')) }} />
      </View>}
    </>}
  </>

  const deckButtons = <View style={{ flexDirection: 'row', gap: 12 }}>
    <ControlButton testID="control-previous" label="Back" accessibilityLabel="Previous part" icon="back" iconOnly={wide} minWidth={96} height={76}
      accessibilityHint={previousPart ? `Moves the service back to ${capitalized(previousPart.role)}.` : undefined} {...holds('previous')}
      onPress={() => { void run('previous', () => commands.previous(sessionId, expected)) }} />
    <ControlButton testID="control-next" variant="primary" label={wide ? 'Next' : 'Next part'} accessibilityLabel="Next part" labelVariant="heading" flex={1} height={76}
      accessibilityHint={nextPart ? `Moves the service to ${capitalized(nextPart.role)}.` : undefined} {...holds('next')}
      onPress={() => { void run('next', () => commands.next(sessionId, expected)) }} />
  </View>

  return <View style={{ flex: 1 }}>
    {header}
    {wide ? <View style={{ flex: 1, flexDirection: 'row' }}>
      {readingPane}
      <View testID="control-rail" style={{ width: RAIL_WIDTH, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="muted">COMING UP</AppText>
          {/* Posture travels with upcoming parts: an operator wants a second's warning before telling a congregation to move. */}
          {state.parts.slice(index + 1, index + 1 + COMING_UP).map(item => <View key={item.key} testID={`coming-up-${item.key}`}
            style={{ gap: 2, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
              <AppText variant="label" tone="muted" style={{ fontFamily: mono, minWidth: 28 }}>{String(item.position)}</AppText>
              <AppText variant="label" style={{ flex: 1 }}>{capitalized(item.role)}</AppText>
              {item.posture && <AppText variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{item.posture}</AppText>}
            </View>
            {/* A role alone does not tell an operator where the service is going; the opening words do. */}
            <OpeningLine part={item} language={first} selected={languages} numberOfLines={2} />
          </View>)}
          {part && !nextPart && <AppText variant="caption" tone="muted">This is the last part.</AppText>}
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
            <AppText variant="caption">{nextPart ? `Next up · ${capitalized(nextPart.role)}` : part ? 'This is the last part.' : ''}</AppText>
            {nextPart && <OpeningLine part={nextPart} language={first} selected={languages} numberOfLines={1} />}
          </View>
          <View style={{ flexDirection: 'row', marginRight: -spacing.sm }}>{languagesButton}{serviceButton}</View>
        </View>
        {deckButtons}
      </View>}
    </>}
  </View>
}

function statusPill(status: string): { label: string; tone: 'success' | 'warning' | 'info'; icon: 'connected' | 'paused' | 'alert' | 'info' } {
  const label = (STATUS_LABELS as Record<string, string>)[status] ?? statusLabel(status)
  if (status === 'active') return { label, tone: 'success', icon: 'connected' }
  if (status === 'paused') return { label, tone: 'warning', icon: 'paused' }
  // While an announcement is up the congregation is not seeing the reading: warning, not danger, since nothing is broken.
  if (status === 'showing_custom') return { label: 'Announcement showing', tone: 'warning', icon: 'alert' }
  return { label, tone: 'info', icon: 'info' }
}
