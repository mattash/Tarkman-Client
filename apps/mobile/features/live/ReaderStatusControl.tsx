import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, findNodeHandle, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { BackButton } from '../../components/BackButton'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing } from '../../design/tokens'
import { formatLocale, useI18n } from '../i18n'
import type { ReaderState } from './state'

type ServiceStatus = 'live' | 'paused' | 'ended' | 'unlisted' | 'unknown' | 'loading'
type ConnectionStatus = 'connected' | 'syncing' | 'reconnecting' | 'offline' | 'updatesUnavailable'

const serviceKeys = {
  live: 'statusControl.live', paused: 'statusControl.paused', ended: 'statusControl.ended',
  unlisted: 'statusControl.unlisted', unknown: 'statusControl.unknown', loading: 'statusControl.loading',
} as const
const connectionKeys = {
  connected: 'statusControl.connected', syncing: 'statusControl.syncing', reconnecting: 'statusControl.reconnecting',
  offline: 'statusControl.offline', updatesUnavailable: 'statusControl.updatesUnavailable',
} as const

function serviceStatus(state: ReaderState): ServiceStatus {
  if (state.loading && !state.session) return 'loading'
  if (!state.session) return 'unknown'
  if (!state.listed) return 'unlisted'
  // These are known presentation modes of an ongoing service, not an unknown service state.
  if (['active', 'showing_gospel', 'showing_epistle', 'showing_prophetic', 'showing_welcome', 'showing_custom', 'showing_session_qr'].includes(state.session.status)) return 'live'
  if (state.session.status === 'paused') return 'paused'
  if (state.session.status === 'ended') return 'ended'
  return 'unknown'
}

function focus(target: View | null) {
  if (!target) return
  if (Platform.OS === 'web') (target as unknown as HTMLElement).focus()
  else {
    const handle = findNodeHandle(target)
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }
}

export function ReaderStatusControl({ state, online, retry, back }: { state: ReaderState; online: boolean; retry(): void; back(): void }) {
  const { colors, scheme } = useTheme()
  const { t, language } = useI18n()
  const { width, height, fontScale } = useWindowDimensions()
  const trigger = useRef<View>(null), serviceLine = useRef<View>(null)
  const [pulse] = useState(() => new Animated.Value(1))
  const previousConnection = useRef<ConnectionStatus | null>(null)
  const degradedEpisode = useRef(false)
  const announcedProblem = useRef(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reduceMotion, setReduceMotion] = useState(true)
  const [longLoss, setLongLoss] = useState(false)
  const [open, setOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [anchor, setAnchor] = useState({ x: spacing.page + 48, y: 0, width: 44, height: 44 })

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => { mounted = false; subscription.remove() }
  }, [])
  useEffect(() => {
    const reset = setTimeout(() => setLongLoss(false), 0)
    if (online && !state.connected) {
      const timer = setTimeout(() => setLongLoss(true), 15000)
      return () => { clearTimeout(reset); clearTimeout(timer) }
    }
    return () => clearTimeout(reset)
  }, [online, state.connected])
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current) }, [])

  const service = serviceStatus(state)
  const connection: ConnectionStatus = !online ? 'offline'
    : !state.connected ? longLoss ? 'offline' : 'reconnecting'
    : state.error && !state.refreshing ? 'updatesUnavailable'
    : state.loading || state.refreshing || state.stale ? 'syncing' : 'connected'
  const problem = connection === 'offline' || connection === 'updatesUnavailable'
  const unconfirmed = problem || connection === 'reconnecting'
  const showConnection = service !== 'ended' && service !== 'unlisted' && service !== 'loading'
  const serviceName = t(serviceKeys[service])
  const connectionName = t(connectionKeys[retrying && problem ? 'reconnecting' : connection])
  const lastConfirmed = state.updatedAt == null ? null : new Date(state.updatedAt).toLocaleTimeString(formatLocale(language), { hour: 'numeric', minute: '2-digit' })
  const label = service === 'loading' ? t('statusControl.loading') : !showConnection ? t('statusControl.serviceLabel', { service: serviceName })
    : unconfirmed && lastConfirmed ? t('statusControl.staleLabel', { service: serviceName, time: lastConfirmed, connection: connectionName })
    : t('statusControl.label', { service: serviceName, connection: connectionName })

  useEffect(() => {
    const previous = previousConnection.current
    previousConnection.current = connection
    if (previous === null || service === 'loading' || !showConnection) return
    if (connection === 'reconnecting' || problem) degradedEpisode.current = true
    if (problem && !announcedProblem.current) {
      announcedProblem.current = true
      AccessibilityInfo.announceForAccessibility(t(connection === 'updatesUnavailable' ? 'statusControl.updatesAnnouncement' : 'statusControl.offlineAnnouncement'))
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 160, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 190, useNativeDriver: true }),
        ]).start()
      }
    } else if (connection === 'connected' && degradedEpisode.current) {
      degradedEpisode.current = false
      announcedProblem.current = false
      AccessibilityInfo.announceForAccessibility(t('statusControl.restoredAnnouncement'))
    }
  }, [connection, problem, reduceMotion, pulse, service, showConnection, t])
  const close = () => { setOpen(false); requestAnimationFrame(() => focus(trigger.current)) }
  const show = () => {
    trigger.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setAnchor({ x, y, width: measuredWidth, height: measuredHeight })
      setOpen(true)
    })
  }
  const tryAgain = () => {
    setRetrying(true)
    retry()
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(() => setRetrying(false), 3000)
  }
  const popWidth = Math.min(width - 28, 360)
  const left = Math.max(14, Math.min(anchor.x + anchor.width / 2 - 42, width - popWidth - 14))
  const top = anchor.y + anchor.height + 6
  const iconSize = Math.min(21, 16 * Math.min(fontScale, 1.3))
  const circleColor = service === 'live' ? colors.success : service === 'paused' ? colors.muted : colors.disabled
  const quiet = service === 'ended' || service === 'unlisted' || service === 'unknown' || service === 'loading'
  const iconColor = quiet ? colors.onDisabled : unconfirmed ? circleColor : scheme === 'dark' ? colors.background : colors.onPrimary
  const icon = service === 'live' ? 'broadcast' : service === 'paused' ? 'paused' : service === 'ended' ? 'ended' : 'help'
  const message = service === 'ended' ? t('statusControl.endedMessage') : service === 'unlisted' ? t('statusControl.unlistedMessage')
    : retrying ? t('statusControl.retryAutomatic')
    : service === 'paused' && problem ? t('statusControl.pausedOfflineMessage') : service === 'paused' && connection === 'connected' ? t('statusControl.pausedMessage')
    : connection === 'reconnecting' ? t('statusControl.retryAutomatic') : connection === 'offline' ? t('statusControl.offlineMessage')
    : connection === 'updatesUnavailable' ? t('statusControl.updatesMessage') : null

  return <>
    <Pressable ref={trigger} testID="reader-status-control" accessibilityRole={service === 'loading' ? undefined : 'button'}
      accessibilityLabel={label} accessibilityHint={service === 'loading' ? undefined : t('statusControl.showDetails')}
      accessibilityShowsLargeContentViewer accessibilityLargeContentTitle={showConnection ? `${serviceName} · ${connectionName}` : serviceName}
      accessibilityState={{ expanded: open, disabled: service === 'loading' }} disabled={service === 'loading'} onPress={show}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22,
        backgroundColor: open ? colors.secondary : 'transparent' }}>
      <Animated.View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: unconfirmed && !quiet ? colors.overlay : circleColor,
        borderWidth: unconfirmed && !quiet ? 2 : 0, borderColor: circleColor, transform: [{ scale: pulse }] }}>
        {service !== 'loading' && <AppIcon name={icon} size={iconSize} color={iconColor} />}
      </Animated.View>
      {showConnection && <View accessible={false} style={{ position: 'absolute', right: 1, bottom: 1, width: 17, height: 17,
        borderRadius: 9, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center',
        backgroundColor: connection === 'connected' ? colors.success : problem ? colors.destructive : colors.overlay }}>
        {connection === 'syncing' && <AppIcon name="live" size={9} color={colors.success} />}
        {connection === 'reconnecting' && <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2,
          borderStyle: 'dashed', borderColor: colors.warning }} />}
        {problem && <AppText variant="label" style={{ fontSize: 10, lineHeight: 12, color: scheme === 'dark' ? colors.background : colors.onDestructive }}>!</AppText>}
      </View>}
    </Pressable>
    <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'fade'} presentationStyle="overFullScreen"
      statusBarTranslucent onRequestClose={close} onShow={() => focus(serviceLine.current)} onDismiss={() => focus(trigger.current)}>
      <View style={{ flex: 1 }}>
        <Pressable testID="reader-status-backdrop" accessible={false} onPress={close} onTouchMove={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View testID="reader-status-popover" accessibilityViewIsModal onAccessibilityEscape={close}
          style={{ position: 'absolute', top, left, width: popWidth, maxHeight: Math.min(height * 0.6, Math.max(180, height - top - 16)),
            backgroundColor: colors.overlay, borderColor: colors.divider, borderWidth: 1, borderRadius: radii.card,
            shadowColor: colors.foreground, shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
          <View accessible={false} style={{ position: 'absolute', top: -7, left: Math.max(18, Math.min(popWidth - 24, anchor.x + anchor.width / 2 - left - 6)),
            width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: colors.overlay,
            borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.divider }} />
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}>
            <View ref={serviceLine} accessible focusable accessibilityLabel={`${t('statusControl.service')} ${serviceName}`}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <AppText variant="label" tone="muted">{t('statusControl.service')}</AppText><AppText variant="label">{serviceName}</AppText>
            </View>
            {showConnection && <View accessible accessibilityLabel={`${t('statusControl.connection')} ${connectionName}`}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <AppText variant="label" tone="muted">{t('statusControl.connection')}</AppText><AppText variant="label">{connectionName}</AppText>
            </View>}
            {unconfirmed && lastConfirmed && <AppText variant="caption" tone="muted">{t('statusControl.lastConfirmed', { time: lastConfirmed })}</AppText>}
            {message && <AppText variant="caption" style={{ marginTop: spacing.xs }}>{message}</AppText>}
            <View style={{ flexDirection: fontScale >= 1.5 ? 'column' : 'row', flexWrap: fontScale >= 1.5 ? 'nowrap' : 'wrap',
              alignItems: fontScale >= 1.5 ? 'stretch' : 'center', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }}>
              {service === 'unlisted' && <BackButton onPress={() => { setOpen(false); back() }}>{t('common.allServices')}</BackButton>}
              {showConnection && problem && <AppButton variant="secondary" size="tier" icon="refresh" loading={retrying} onPress={tryAgain}>
                {t(retrying ? 'statusControl.retrying' : 'common.retry')}
              </AppButton>}
              <AppButton variant="text" onPress={close}>{t('common.close')}</AppButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}
