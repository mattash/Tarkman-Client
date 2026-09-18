import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { Notice } from '../../components/Notice'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import type { ReaderState } from './state'

export function ControlConnectionStatus({ state, offline, sending }: { state: ReaderState; offline: boolean; sending: boolean }) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [reduceMotion, setReduceMotion] = useState(true)
  const [rotation] = useState(() => new Animated.Value(0))
  const failed = !!state.error && !state.refreshing && !sending
  const working = !offline && (!state.connected || (!failed && (state.loading || state.refreshing || state.stale || sending)))
  const label = offline ? t('control.offlineStatus')
    : !state.connected ? t(state.loading ? 'control.connecting' : 'common.reconnecting')
    : failed ? t('readerStatus.updatesUnavailable')
    : working ? t('control.synchronizing') : t('control.connected')
  const color = offline ? colors.onDisabled : failed ? colors.destructive : working ? colors.info : colors.success
  const backgroundColor = offline ? colors.disabled : failed ? colors.dangerSurface : working ? colors.infoSurface : colors.successSurface

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => { mounted = false; subscription.remove() }
  }, [])
  useEffect(() => {
    if (!working || reduceMotion) { rotation.setValue(0); return }
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 1200, easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web', isInteraction: false }))
    loop.start()
    return () => { loop.stop(); rotation.setValue(0) }
  }, [working, reduceMotion, rotation])

  const labels = [t('control.connected'), t('control.synchronizing'), t('control.connecting'), t('common.reconnecting'),
    t('control.offlineStatus'), t('readerStatus.updatesUnavailable')]
  return <View testID="control-connection" accessible accessibilityLabel={t('control.connectionLabel', { status: label })}
    accessibilityState={{ busy: working }} accessibilityLiveRegion="none" style={{ maxWidth: '100%' }}>
    {/* Reserve the widest translated label without a fixed font size or width. The badge can
        grow left inside this slot without wrapping the toolbar or moving the reading below it. */}
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ height: 0, overflow: 'hidden', opacity: 0, paddingHorizontal: spacing.sm }}>
      {labels.map(text => <View key={text} style={{ flexDirection: 'row', gap: spacing.xs }}>
        <AppIcon name="live" size={16} color={color} /><AppText variant="label" numberOfLines={1}>{text}</AppText>
      </View>)}
    </View>
    <View style={{ alignSelf: 'flex-end', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.control, backgroundColor }}>
      <Animated.View testID="control-connection-icon" style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <AppIcon name={offline ? 'offline' : working ? 'live' : failed ? 'alert' : 'connected'} size={16} color={color} />
      </Animated.View>
      <AppText variant="label" numberOfLines={1} style={{ color }}>{label}</AppText>
    </View>
  </View>
}

/** Only actionable recovery belongs below the reading; routine sync is already visible in the toolbar. */
export function ControlConnectionRecovery({ state, retry }: { state: ReaderState; retry(): void }) {
  const { t } = useI18n()
  const disconnected = !!state.session && !state.connected
  if (state.loading || !(state.error || disconnected || state.explanationError)) return null
  const message = state.error ?? (disconnected ? t(state.stale ? 'readerStatus.connectionInterrupted' : 'readerStatus.liveUnavailable')
    : t('readerStatus.explanationsNotLoaded'))
  return <View style={{ gap: spacing.xs }}>
    <Notice tone={state.error ? 'danger' : 'neutral'} accessibilityRole="alert">{message}</Notice>
    <View style={{ alignSelf: 'flex-start' }}>
      <AppButton variant="quiet" icon="live" disabled={state.refreshing} onPress={retry}>
        {t(disconnected ? 'readerStatus.retryConnection' : 'common.retry')}
      </AppButton>
    </View>
  </View>
}
