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
  /** regular 48/8 for toolbars and sheets; card 48/10 inside cards; form 52/12 and hero 54/12 for a screen's one main action. */
  size?: keyof typeof sizes
}
const sizes = {
  regular: { minHeight: touchTarget, radius: radii.control, label: 'label' },
  card: { minHeight: touchTarget, radius: radii.field, label: 'label' },
  form: { minHeight: 52, radius: radii.action, label: 'action' },
  hero: { minHeight: 54, radius: radii.action, label: 'action' },
} as const
export function AppButton({ children, variant = 'primary', loading = false, icon, iconOnly = false, selected = false, rounded = false, size = 'regular', disabled = false, accessibilityState, onFocus, onBlur, onPressIn, onPressOut, ...props }: AppButtonProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  // NativeWind's native runtime replaces function-valued Pressable styles with {}, so pressed state is tracked here.
  const [pressed, setPressed] = useState(false)
  const fontReady = useReadingFont()
  const inactive = disabled || loading
  const metrics = sizes[size]
  // Card and form buttons take the 1pt control outline from the designs; toolbar buttons keep their 2pt divider.
  const outlined = size !== 'regular'
  // A 1pt outline grows to the 2pt focus ring without moving the label.
  const borderWidth = outlined && !focused ? 1 : 2
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
    style={{ minHeight: metrics.minHeight, minWidth: touchTarget, paddingVertical: spacing.sm + 2 - borderWidth, paddingHorizontal: (iconOnly && fontReady ? spacing.sm : spacing.md) + 2 - borderWidth,
      borderRadius: rounded ? 999 : metrics.radius, backgroundColor, borderWidth, borderColor: focused ? (variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : colors.focus) : variant === 'secondary' && !selected ? (outlined ? colors.border : colors.divider) : 'transparent', flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
    {loading && <ActivityIndicator color={color} accessible={false} />}
    {icon && !loading && <AppIcon name={icon} color={color} />}
    {(!iconOnly || !fontReady) && <AppText variant={metrics.label} style={{ color, textAlign: 'center' }}>{children}</AppText>}
  </Pressable>
}
