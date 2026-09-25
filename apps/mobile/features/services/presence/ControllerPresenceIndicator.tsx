import { useEffect, useRef } from 'react'
import { AccessibilityInfo, View } from 'react-native'
import { AppIcon } from '../../../components/AppIcon'
import { AppText } from '../../../components/AppText'
import { useTheme } from '../../../design/ThemeProvider'
import { spacing } from '../../../design/tokens'
import { useI18n } from '../../i18n'
import type { PresenceState } from './coordinator'
import { AnchoredCallout } from './AnchoredCallout'

export function presenceLabel(state: PresenceState, t: ReturnType<typeof useI18n>['t']): string {
  if (state.kind === 'checking') return t('presence.checking')
  if (state.kind !== 'fresh' || !state.snapshot?.selfPresent) return t('presence.unavailable')
  return state.snapshot.others === 0 ? t('presence.none') : t('presence.others', { count: state.snapshot.others })
}
export function ControllerPresenceIndicator({ state }: { state: PresenceState }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const label = presenceLabel(state, t)
  const previous = useRef<string | null>(null)
  useEffect(() => {
    if (previous.current !== null && previous.current !== label && state.kind === 'fresh' && state.snapshot && state.snapshot.others > 0) {
      void AccessibilityInfo.announceForAccessibility(label)
    }
    previous.current = label
  }, [label, state])
  const count = state.kind === 'fresh' && state.snapshot?.selfPresent ? state.snapshot.others : null
  return <View testID="controller-presence">
    <AnchoredCallout testID="controller-presence" label={label} title={t('presence.otherTitle')}
      trigger={<View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' }}>
        <AppIcon name="people" size={26} color={count !== null && count > 0 ? colors.warning : colors.muted} />
        {count !== null && <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18,
          paddingHorizontal: 3, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
          <AppText maxFontSizeMultiplier={1} style={{ fontSize: 11, lineHeight: 16, color: colors.onSecondary }}>{count > 9 ? '9+' : count}</AppText>
        </View>}
      </View>}>
      <AppText variant="heading">{count === null ? label : t('presence.connectedCount', { count })}</AppText>
      <AppText variant="caption" tone="muted">{count === 0 ? t('presence.noneReporting')
        : count === null ? t('presence.unavailable') : t('presence.otherCanChange')}</AppText>
    </AnchoredCallout>
  </View>
}

export function ControllerStatusRow({ state }: { state: PresenceState }) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const summary = state.kind === 'fresh' && state.snapshot?.selfPresent
    ? t('presence.connectedCount', { count: state.snapshot.count }) : presenceLabel(state, t)
  return <View testID="service-controller-status" style={{ flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: spacing.sm }}>
    <AppText variant="label" style={{ flex: 1 }}>{t('presence.title')}</AppText>
    <AppText>{summary}</AppText>
    <AnchoredCallout testID="controller-help" label={t('presence.helpLabel')} title={t('presence.title')}
      trigger={<View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondary,
        alignItems: 'center', justifyContent: 'center' }}>
        <AppIcon name="details" size={21} color={colors.onSecondary} />
      </View>}>
      <AppText variant="caption">{t('presence.includesDevice')}</AppText>
      <AppText variant="caption" tone="muted">{t('presence.caveat')}</AppText>
    </AnchoredCallout>
  </View>
}
