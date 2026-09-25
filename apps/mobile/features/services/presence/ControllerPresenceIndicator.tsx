import { useEffect, useRef } from 'react'
import { AccessibilityInfo, View } from 'react-native'
import { AppIcon } from '../../../components/AppIcon'
import { AppText } from '../../../components/AppText'
import { useTheme } from '../../../design/ThemeProvider'
import { spacing } from '../../../design/tokens'
import { useI18n } from '../../i18n'
import type { PresenceState } from './coordinator'

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
  return <View testID="controller-presence" accessible accessibilityRole="text" accessibilityLabel={label}
    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' }}>
    <AppIcon name="people" color={state.kind === 'fresh' && state.snapshot?.others ? colors.warning : colors.muted} />
    <AppText variant="caption" style={{ flexShrink: 1, color: state.kind === 'fresh' && state.snapshot?.others ? colors.warning : colors.muted }}>{label}</AppText>
  </View>
}
