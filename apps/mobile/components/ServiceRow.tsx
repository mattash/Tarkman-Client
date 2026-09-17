import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, touchTarget } from '../design/tokens'
import { AppIcon } from './AppIcon'
import { AppText } from './AppText'
import { useI18n } from '../features/i18n'

/** A tappable service summary: optional live dot, serif title, one line of context, and a chevron. */
export function ServiceRow({ title, subtitle, live = false, accessibilityLabel, onPress, testID }: {
  title: string; subtitle?: string | null; live?: boolean; accessibilityLabel?: string; onPress(): void; testID?: string
}) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18,
      borderRadius: radii.card, borderWidth: 1, borderColor: colors.divider, backgroundColor: pressed ? colors.pressedSubtle : colors.raised }}>
    {live && <LiveDot />}
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="rowTitle">{title}</AppText>
      {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
    </View>
    <AppIcon name="next" color={colors.border} size={20} />
  </Pressable>
}

export function LiveDot() {
  const { colors } = useTheme()
  return <View accessible={false} importantForAccessibility="no" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
}

/** "Live now" as text on the success pair; the dot is decoration and hidden from assistive technology. */
export function LivePill({ label }: { label?: string }) {
  const { colors } = useTheme()
  const { t } = useI18n()
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 27, paddingHorizontal: 11,
    borderRadius: 999, backgroundColor: colors.successSurface }}>
    <LiveDot />
    <AppText variant="caption" style={{ color: colors.success, fontWeight: '600' }}>{label ?? t('common.liveNow')}</AppText>
  </View>
}
