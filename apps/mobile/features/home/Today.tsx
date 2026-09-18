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
import { useRecentlyControlled } from '../progress/recentlyControlled'
import { useAuth } from '../auth/AuthProvider'
import { useServices } from './ServicesProvider'
import { useI18n } from '../i18n'

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
  const { state: auth } = useAuth()
  const operatorId = auth.status === 'signedIn' ? auth.user.id : null
  const { services: controlled, reload: reloadControlled } = useRecentlyControlled(operatorId)
  const { t } = useI18n()
  const [pulling, setPulling] = useState(false)
  const { check } = nearby
  const located = state.services.some(session => session.latitude !== null && session.longitude !== null)
  const serviceKey = state.services.map(session => session.id).join(',')

  // Placing a reader never prompts: this only looks when location was already allowed from the button below.
  // It runs when Today is shown or the set of listed services changes, not on every poll.
  useFocusEffect(useCallback(() => {
    reload()
    reloadControlled()
    if (located && serviceKey) void check()
  }, [reload, reloadControlled, located, serviceKey, check]))

  const found = nearby.state.status === 'found' ? state.services.find(session => nearby.state.status === 'found' && session.id === nearby.state.nearby.session.id) : undefined
  const lead = found ?? (state.services.length === 1 ? state.services[0] : undefined)
  const others = state.services.filter(session => session !== lead)
  const open = (session: LiveSession) => router.push(`/sessions/${session.id}/parts`)
  const page = fontScale > 2 ? spacing.md : spacing.page
  const nothingLive = !state.loading && !state.error && state.services.length === 0

  return <ScrollView testID="today" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.lg }}
    refreshControl={<RefreshControl refreshing={pulling && state.refreshing} tintColor={colors.muted} onRefresh={() => { setPulling(true); retry() }} />}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <ScreenHeader title={t('today.title')}>
        <HeaderIconButton testID="today-scan" icon="scan" label={t('common.scanACode')} onPress={() => router.push('/scan')} />
        <HeaderIconButton icon="tab-settings" label={t('common.settings')} onPress={() => router.navigate('/settings')} />
      </ScreenHeader>

      {state.loading && <AppText tone="muted" style={{ marginTop: 18 }} accessibilityLiveRegion="polite">{t('today.lookingForServices')}</AppText>}
      {state.error && !state.loading && <View style={{ marginTop: 18 }}><ReaderStatus state={state} retry={retry} /></View>}

      {state.services.length > 0 && <>
        {located && <LocationLine state={nearby.state} church={found?.church} find={() => { void nearby.find() }} />}
        {lead && <LeadService session={lead} placed={!!found} open={() => open(lead)} />}
        {others.length > 0 && <View style={{ marginTop: lead ? 26 : 18, gap: 10 }}>
          <AppText variant="label" tone="muted" accessibilityRole="header">{lead ? t('today.alsoLiveElsewhere') : t('common.liveNow')}</AppText>
          {others.map(session => <ServiceRow key={session.id} live title={session.title} subtitle={session.church}
            accessibilityLabel={t('today.rowLiveLabel', { title: session.title, church: session.church })} onPress={() => open(session)} />)}
        </View>}
      </>}

      {nothingLive && <>
        <AppText tone="muted" style={{ marginTop: 18 }}>{t('today.nothingLive')}</AppText>
        <ScanRow />
        {reading && <View style={{ marginTop: 26, gap: 10 }}>
          <AppText variant="label" tone="muted" accessibilityRole="header">{t('today.continueReading')}</AppText>
          <ServiceRow testID="continue-reading" title={reading.title}
            subtitle={[relativeServiceDay(reading.date), reading.role ? t('today.stoppedAt', { role: roleLabel(reading.role) }) : null].filter(Boolean).join(' · ') || reading.church}
            onPress={() => router.push(`/sessions/${reading.sessionId}/parts`)} />
        </View>}
      </>}

      {controlled.length > 0 && <View style={{ marginTop: 26, gap: 10 }}>
        <AppText variant="label" tone="muted" accessibilityRole="header">{t('today.recentlyControlled')}</AppText>
        {controlled.map(service => <ServiceRow key={service.sessionId} testID={`controlled-${service.sessionId}`} title={service.title}
          subtitle={[relativeServiceDay(service.date), service.church].filter(Boolean).join(' · ')}
          accessibilityLabel={t('myServices.openControlsLabel', { title: service.title })}
          onPress={() => router.push(`/services/${service.sessionId}`)} />)}
      </View>}
    </View>
  </ScrollView>
}

function LeadService({ session, placed, open }: { session: LiveSession; placed: boolean; open(): void }) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const live = session.status === 'active'
  return <View testID="lead-service" style={{ marginTop: 14, padding: 22, gap: spacing.md, borderRadius: radii.feature, borderWidth: 1,
    borderColor: colors.divider, backgroundColor: colors.raised }}>
    {live ? <LivePill /> : <View style={{ alignSelf: 'flex-start', paddingHorizontal: 11, minHeight: 27, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.warningSurface }}>
      <AppText variant="caption" style={{ color: colors.warning, fontWeight: '600' }}>{session.status === 'paused' ? t('common.paused') : roleLabel(session.status)}</AppText>
    </View>}
    <View style={{ gap: spacing.xs }}>
      <AppText variant="feature">{session.title}</AppText>
      {!placed && <AppText variant="caption" tone="muted">{session.church}</AppText>}
    </View>
    {/* Shown only when discovery publishes the current part's role. Never a part number. */}
    {session.currentRole && <View testID="now-reading" style={{ paddingVertical: 13, paddingHorizontal: 15, gap: 3, borderRadius: radii.action, backgroundColor: colors.background }}>
      <AppText variant="eyebrow" tone="muted" style={{ letterSpacing: 0.4 }}>{t('today.nowReading')}</AppText>
      <AppText variant="explanation">{roleLabel(session.currentRole)}</AppText>
    </View>}
    <AppButton size="hero" onPress={open} accessibilityHint={t(live ? 'today.readAlongHintLive' : 'today.readAlongHintToday', { title: session.title, church: session.church })}>{t('common.readAlong')}</AppButton>
  </View>
}

function LocationLine({ state, church, find }: { state: NearbyState; church?: string; find(): void }) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const line = (text: string) => <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 23 }}>
    <AppIcon name="location" color={colors.muted} size={16} />
    <AppText variant="label" tone="muted" style={{ flex: 1, fontWeight: '400' }} accessibilityLiveRegion="polite">{text}</AppText>
  </View>
  if (state.status === 'found' && church) return line(t('today.youreAt', { church }))
  if (state.status === 'looking') return line(t('today.checkingWhere'))
  if (state.status === 'none') return line(t('today.noneNearby'))
  if (state.status === 'refused' && !state.canAskAgain) return null
  return <Pressable accessibilityRole="button" accessibilityHint={t('today.locationHint')} onPress={find}
    style={{ marginTop: 14 - (touchTarget - 23) / 2, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
    <AppIcon name="location" color={colors.primary} size={16} />
    <AppText variant="label" tone="accent">{state.status === 'unavailable' ? t('today.locationUnavailable') : t('today.findChurch')}</AppText>
  </Pressable>
}

function ScanRow() {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [pressed, setPressed] = useState(false)
  return <Pressable testID="scan-row" accessibilityRole="button" accessibilityLabel={t('common.scanACode')} accessibilityHint={t('today.scanHint')}
    onPress={() => router.push('/scan')} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ marginTop: 20, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: spacing.md, paddingHorizontal: 18,
      borderRadius: radii.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: pressed ? colors.pressedSubtle : 'transparent' }}>
    <AppIcon name="scan" color={colors.primary} size={24} />
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="label">{t('common.scanACode')}</AppText>
      <AppText variant="caption" tone="muted">{t('today.scanHint')}</AppText>
    </View>
  </Pressable>
}
