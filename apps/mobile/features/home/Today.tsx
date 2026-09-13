import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader'
import { LivePill, ServiceRow } from '../../components/ServiceRow'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../../design/tokens'
import type { LiveSession } from '../live/contracts'
import { ReaderStatus } from '../live/ReaderStatus'
import { useNearbyChurch, type NearbyState } from '../nearby/useNearbyChurch'
import { relativeServiceDay, roleLabel, useLastReading } from '../progress/lastReading'
import { useServices } from './ServicesProvider'

/**
 * Today is a ladder into the service: the church you are at when location knows it, a scanned
 * code when it does not, and the list when neither works. Nothing here needs an account.
 */
export function Today() {
  const { state, retry } = useServices()
  const { colors } = useTheme()
  const { fontScale } = useWindowDimensions()
  const nearby = useNearbyChurch(state.services)
  const { reading, reload } = useLastReading()
  const [pulling, setPulling] = useState(false)
  const { check } = nearby
  const located = state.services.some(session => session.latitude !== null && session.longitude !== null)
  const serviceKey = state.services.map(session => session.id).join(',')

  // Placing a reader never prompts: this only looks when location was already allowed from the button below.
  // It runs when Today is shown or the set of listed services changes, not on every poll.
  useFocusEffect(useCallback(() => {
    reload()
    if (located && serviceKey) void check()
  }, [reload, located, serviceKey, check]))

  const found = nearby.state.status === 'found' ? state.services.find(session => nearby.state.status === 'found' && session.id === nearby.state.nearby.session.id) : undefined
  const lead = found ?? (state.services.length === 1 ? state.services[0] : undefined)
  const others = state.services.filter(session => session !== lead)
  const open = (session: LiveSession) => router.push(`/sessions/${session.id}/parts`)
  const page = fontScale > 2 ? spacing.md : spacing.page
  const nothingLive = !state.loading && !state.error && state.services.length === 0

  return <ScrollView testID="today" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.lg }}
    refreshControl={<RefreshControl refreshing={pulling && state.refreshing} tintColor={colors.muted} onRefresh={() => { setPulling(true); retry() }} />}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <ScreenHeader title="Today">
        <HeaderIconButton testID="today-scan" icon="scan" label="Scan a code" onPress={() => router.push('/scan')} />
        <HeaderIconButton icon="tab-settings" label="Settings" onPress={() => router.navigate('/settings')} />
      </ScreenHeader>

      {state.loading && <AppText tone="muted" style={{ marginTop: 18 }} accessibilityLiveRegion="polite">Looking for live services…</AppText>}
      {state.error && !state.loading && <View style={{ marginTop: 18 }}><ReaderStatus state={state} retry={retry} /></View>}

      {state.services.length > 0 && <>
        {located && <LocationLine state={nearby.state} church={found?.church} find={() => { void nearby.find() }} />}
        {lead && <LeadService session={lead} placed={!!found} open={() => open(lead)} />}
        {others.length > 0 && <View style={{ marginTop: lead ? 26 : 18, gap: 10 }}>
          <AppText variant="label" tone="muted" accessibilityRole="header">{lead ? 'Also live elsewhere' : 'Live now'}</AppText>
          {others.map(session => <ServiceRow key={session.id} live title={session.title} subtitle={session.church}
            accessibilityLabel={`${session.title}, ${session.church}, live now`} onPress={() => open(session)} />)}
        </View>}
      </>}

      {nothingLive && <>
        <AppText tone="muted" style={{ marginTop: 18 }}>No service is live right now.</AppText>
        <ScanRow />
        {reading && <View style={{ marginTop: 26, gap: 10 }}>
          <AppText variant="label" tone="muted" accessibilityRole="header">Continue reading</AppText>
          <ServiceRow testID="continue-reading" title={reading.title}
            subtitle={[relativeServiceDay(reading.date), reading.role ? `stopped at ${roleLabel(reading.role)}` : null].filter(Boolean).join(' · ') || reading.church}
            onPress={() => router.push(`/sessions/${reading.sessionId}/parts`)} />
        </View>}
      </>}
    </View>
  </ScrollView>
}

function LeadService({ session, placed, open }: { session: LiveSession; placed: boolean; open(): void }) {
  const { colors } = useTheme()
  const live = session.status === 'active'
  return <View testID="lead-service" style={{ marginTop: 14, padding: 22, gap: spacing.md, borderRadius: radii.feature, borderWidth: 1,
    borderColor: colors.divider, backgroundColor: colors.raised }}>
    {live ? <LivePill /> : <View style={{ alignSelf: 'flex-start', paddingHorizontal: 11, minHeight: 27, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.warningSurface }}>
      <AppText variant="caption" style={{ color: colors.warning, fontWeight: '600' }}>{session.status === 'paused' ? 'Paused' : roleLabel(session.status)}</AppText>
    </View>}
    <View style={{ gap: spacing.xs }}>
      <AppText variant="feature">{session.title}</AppText>
      {!placed && <AppText variant="caption" tone="muted">{session.church}</AppText>}
    </View>
    {/* Shown only when discovery publishes the current part's role. Never a part number. */}
    {session.currentRole && <View testID="now-reading" style={{ paddingVertical: 13, paddingHorizontal: 15, gap: 3, borderRadius: radii.action, backgroundColor: colors.background }}>
      <AppText variant="eyebrow" tone="muted" style={{ letterSpacing: 0.4 }}>NOW READING</AppText>
      <AppText variant="explanation">{roleLabel(session.currentRole)}</AppText>
    </View>}
    <AppButton size="hero" onPress={open} accessibilityHint={`Opens ${session.title}, ${live ? 'live now' : 'today'} at ${session.church}.`}>Read along</AppButton>
  </View>
}

function LocationLine({ state, church, find }: { state: NearbyState; church?: string; find(): void }) {
  const { colors } = useTheme()
  const line = (text: string) => <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 23 }}>
    <AppIcon name="location" color={colors.muted} size={16} />
    <AppText variant="label" tone="muted" style={{ flex: 1, fontWeight: '400' }} accessibilityLiveRegion="polite">{text}</AppText>
  </View>
  if (state.status === 'found' && church) return line(`You’re at ${church}`)
  if (state.status === 'looking') return line('Checking where you are…')
  if (state.status === 'none') return line('No live service at a church near you.')
  if (state.status === 'refused' && !state.canAskAgain) return null
  return <Pressable accessibilityRole="button" accessibilityHint="Uses your location on this device only. It is never sent anywhere." onPress={find}
    style={{ marginTop: 14 - (touchTarget - 23) / 2, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
    <AppIcon name="location" color={colors.primary} size={16} />
    <AppText variant="label" tone="accent">{state.status === 'unavailable' ? 'Location unavailable. Try again' : 'Find the church you’re at'}</AppText>
  </Pressable>
}

function ScanRow() {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable testID="scan-row" accessibilityRole="button" accessibilityLabel="Scan a code" accessibilityHint="If your church shows one on screen"
    onPress={() => router.push('/scan')} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ marginTop: 20, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: spacing.md, paddingHorizontal: 18,
      borderRadius: radii.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: pressed ? colors.pressedSubtle : 'transparent' }}>
    <AppIcon name="scan" color={colors.primary} size={24} />
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="label">Scan a code</AppText>
      <AppText variant="caption" tone="muted">If your church shows one on screen</AppText>
    </View>
  </Pressable>
}
