import { useState, type ReactNode } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, touchTarget } from '../design/tokens'
import { AppIcon, type IconName } from './AppIcon'
import { AppText } from './AppText'

/** A tab screen's large serif title with up to two 48pt icon actions trailing it. */
export function ScreenHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { fontScale } = useWindowDimensions()
  // Above 2× the 28pt title steps to the 23pt heading, still fully scaled, so a one-word title never breaks mid-word.
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', minHeight: touchTarget }}>
    <AppText variant={fontScale > 2 ? 'heading' : 'screenTitle'} style={{ flexShrink: 1 }}>{title}</AppText>
    {children && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -10, marginLeft: 'auto' }}>{children}</View>}
  </View>
}

export function HeaderIconButton({ icon, label, hint, onPress, testID }: { icon: IconName; label: string; hint?: string; onPress(): void; testID?: string }) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.field,
      backgroundColor: pressed ? colors.pressedSubtle : 'transparent' }}>
    <AppIcon name={icon} color={colors.primary} size={24} />
  </Pressable>
}
