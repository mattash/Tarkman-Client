import { View, type AccessibilityRole } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii } from '../design/tokens'
import { AppIcon } from './AppIcon'
import { AppText } from './AppText'

/** An inline message on its paired surface: danger for failures, neutral for plain facts. Never color alone. */
export function Notice({ tone, children, accessibilityRole }: { tone: 'danger' | 'neutral'; children: string; accessibilityRole?: AccessibilityRole }) {
  const { colors } = useTheme()
  const color = tone === 'danger' ? colors.destructive : colors.onDisabled
  return <View accessible accessibilityRole={accessibilityRole} accessibilityLabel={children}
    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.action,
      backgroundColor: tone === 'danger' ? colors.dangerSurface : colors.disabled }}>
    <View style={{ marginTop: 1 }}><AppIcon name={tone === 'danger' ? 'alert' : 'info'} color={color} size={20} /></View>
    <AppText variant={tone === 'danger' ? 'body' : 'caption'} style={{ flex: 1, color: tone === 'danger' ? colors.destructive : colors.foreground,
      ...(tone === 'danger' ? { fontSize: 15, lineHeight: 23 } : {}) }}>{children}</AppText>
  </View>
}
