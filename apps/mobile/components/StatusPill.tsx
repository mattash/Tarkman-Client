import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppIcon, type IconName } from './AppIcon'
import { AppText } from './AppText'

export function StatusPill({ label, message, tone, icon = 'alert', busy = false }: {
  label: string; message?: string; tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; icon?: IconName; busy?: boolean
}) {
  const { colors } = useTheme()
  const color = tone === 'neutral' ? colors.onDisabled : tone === 'danger' ? colors.destructive : colors[tone]
  const backgroundColor = tone === 'neutral' ? colors.disabled : colors[`${tone}Surface`]
  return <View accessible accessibilityLabel={[label, message].filter(Boolean).join('. ')} accessibilityRole={tone === 'danger' ? 'alert' : undefined} accessibilityLiveRegion="polite"
    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
    <View style={{ flexDirection: 'row', flexShrink: 1, maxWidth: '100%', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs, borderRadius: radii.control, backgroundColor }}>
      {busy ? <ActivityIndicator color={color} accessible={false} /> : <AppIcon name={icon} color={color} size={16} />}
      <AppText variant="label" style={{ color }}>{label}</AppText>
    </View>
    {message && <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>{message}</AppText>}
  </View>
}
