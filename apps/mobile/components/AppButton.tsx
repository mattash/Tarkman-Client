import { useState, type Ref } from 'react'
import { ActivityIndicator, Pressable, type PressableProps, type View } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../design/tokens'
import { AppText } from './AppText'

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  ref?: Ref<View>
  children: string
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive'
  loading?: boolean
}
export function AppButton({ children, variant = 'primary', loading = false, disabled = false, accessibilityState, onFocus, onBlur, ...props }: AppButtonProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const inactive = disabled || loading
  const backgroundColor = variant === 'quiet' ? 'transparent' : colors[variant]
  const color = variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : variant === 'secondary' ? colors.onSecondary : colors.primary
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? children}
    accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }} disabled={inactive}
    onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
    style={({ pressed }) => ({ minHeight: touchTarget, minWidth: touchTarget, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      borderRadius: radii.control, backgroundColor, borderWidth: 2, borderColor: focused ? (variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : colors.focus) : 'transparent',
      opacity: inactive ? 0.55 : pressed ? 0.8 : 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' })}>
    {loading && <ActivityIndicator color={color} accessible={false} />}
    <AppText variant="label" style={{ color, textAlign: 'center' }}>{children}</AppText>
  </Pressable>
}
