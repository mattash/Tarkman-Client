import { useState, type Ref } from 'react'
import { ActivityIndicator, Platform, Pressable, type PressableProps, type View } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../design/tokens'
import { AppIcon, type IconName } from './AppIcon'
import { useReadingFont } from '../design/readingFont'
import { AppText } from './AppText'

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  ref?: Ref<View>
  children: string
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive'
  icon?: IconName
  iconOnly?: boolean
  selected?: boolean
  rounded?: boolean
  loading?: boolean
}
export function AppButton({ children, variant = 'primary', loading = false, icon, iconOnly = false, selected = false, rounded = false, disabled = false, accessibilityState, onFocus, onBlur, onPressIn, onPressOut, ...props }: AppButtonProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  // NativeWind's native runtime replaces function-valued Pressable styles with {}, so pressed state is tracked here.
  const [pressed, setPressed] = useState(false)
  const fontReady = useReadingFont()
  const inactive = disabled || loading
  // Only filled actions invert on press; quiet/secondary controls get a neutral tint and keep their text color.
  const strongPress = pressed && (variant === 'primary' || variant === 'destructive')
  const backgroundColor = inactive ? colors.disabled : strongPress ? colors.pressed : pressed ? colors.pressedSubtle : selected ? colors.secondary
    : variant === 'quiet' ? 'transparent' : variant === 'secondary' ? colors.surface : colors[variant]
  const color = inactive ? colors.onDisabled : strongPress ? colors.onPrimary : pressed ? colors.foreground : selected ? colors.onSecondary
    : variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : colors.foreground
  return <Pressable {...props} accessibilityRole={props.accessibilityRole ?? 'button'} accessibilityLabel={props.accessibilityLabel ?? children}
    {...(Platform.OS === 'web' ? { 'aria-checked': accessibilityState?.checked,
      'aria-selected': selected || accessibilityState?.selected, 'aria-disabled': inactive, 'aria-busy': loading } : {})}
    accessibilityState={{ ...accessibilityState, selected: selected || accessibilityState?.selected, disabled: inactive, busy: loading }} disabled={inactive}
    onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
    onPressIn={event => { setPressed(true); onPressIn?.(event) }} onPressOut={event => { setPressed(false); onPressOut?.(event) }}
    style={{ minHeight: touchTarget, minWidth: touchTarget, paddingVertical: spacing.sm, paddingHorizontal: iconOnly && fontReady ? spacing.sm : spacing.md,
      borderRadius: rounded ? 999 : radii.control, backgroundColor, borderWidth: 2, borderColor: focused ? (variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : colors.focus) : variant === 'secondary' && !selected ? colors.divider : 'transparent', flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
    {loading && <ActivityIndicator color={color} accessible={false} />}
    {icon && !loading && <AppIcon name={icon} color={color} />}
    {(!iconOnly || !fontReady) && <AppText variant="label" style={{ color, textAlign: 'center' }}>{children}</AppText>}
  </Pressable>
}
