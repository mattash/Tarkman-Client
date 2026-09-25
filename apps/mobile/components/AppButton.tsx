import { useState, type Ref } from 'react'
import { ActivityIndicator, Platform, Pressable, View, type PressableProps } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget, typography } from '../design/tokens'
import { AppIcon, type IconName } from './AppIcon'
import { useReadingFont } from '../design/readingFont'
import { AppText } from './AppText'

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  ref?: Ref<View>
  children: string
  variant?: 'primary' | 'secondary' | 'secondaryDestructive' | 'quiet' | 'destructive' | 'row' | 'text'
  icon?: IconName
  iconOnly?: boolean
  badgeCount?: number
  highlighted?: boolean
  selected?: boolean
  rounded?: boolean
  loading?: boolean
  labelMaxFontSizeMultiplier?: number
  labelNumberOfLines?: number
  /** regular 48/8 for toolbars and sheets; card 48/10 inside cards; form 52/12 and hero 54/12 for a screen's one main action. */
  size?: keyof typeof sizes
}
const sizes = {
  regular: { minHeight: touchTarget, radius: radii.control, label: 'label' },
  tier: { minHeight: touchTarget, radius: radii.action, label: 'label' },
  card: { minHeight: touchTarget, radius: radii.field, label: 'label' },
  form: { minHeight: 52, radius: radii.action, label: 'action' },
  hero: { minHeight: 54, radius: radii.action, label: 'action' },
} as const
export function AppButton({ children, variant = 'primary', loading = false, icon, iconOnly = false, selected = false, highlighted = false, badgeCount, rounded = false, size = 'regular', disabled = false,
  labelMaxFontSizeMultiplier, labelNumberOfLines, accessibilityState, onFocus, onBlur, onPressIn, onPressOut, ...props }: AppButtonProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  // NativeWind's native runtime replaces function-valued Pressable styles with {}, so pressed state is tracked here.
  const [pressed, setPressed] = useState(false)
  const fontReady = useReadingFont()
  const inactive = disabled || loading
  const metrics = sizes[size]
  // Card and form buttons take the 1pt control outline from the designs; toolbar buttons keep their 2pt divider.
  const outlined = size !== 'regular' || variant === 'secondaryDestructive'
  // A 1pt outline grows to the 2pt focus ring without moving the label.
  const borderWidth = variant === 'text' || variant === 'row' ? 0 : outlined && !focused ? 1.5 : 2
  // Only filled actions invert on press; quiet/secondary controls get a neutral tint and keep their text color.
  const strongPress = pressed && (variant === 'primary' || variant === 'destructive')
  const backgroundColor = inactive ? variant === 'text' ? 'transparent' : colors.disabled
    : strongPress ? colors.pressed : pressed || (focused && (variant === 'text' || variant === 'row')) ? colors.pressedSubtle : selected || highlighted ? colors.secondary
    : variant === 'quiet' || variant === 'text' ? 'transparent' : variant === 'secondary' || variant === 'secondaryDestructive' ? colors.surface
    : variant === 'row' ? colors.secondary : colors[variant]
  const color = inactive ? colors.onDisabled : strongPress ? colors.onPrimary : pressed ? colors.foreground : selected || highlighted ? colors.onSecondary
    : variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive
    : variant === 'secondaryDestructive' ? colors.destructive : variant === 'text' ? colors.primary : colors.foreground
  return <Pressable {...props} accessibilityRole={props.accessibilityRole ?? 'button'} accessibilityLabel={props.accessibilityLabel ?? children}
    {...(Platform.OS === 'web' ? { 'aria-checked': accessibilityState?.checked,
      'aria-selected': selected || accessibilityState?.selected, 'aria-disabled': inactive, 'aria-busy': loading } : {})}
    accessibilityState={{ ...accessibilityState, selected: selected || accessibilityState?.selected, disabled: inactive, busy: loading }} disabled={inactive}
    onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
    onPressIn={event => { setPressed(true); onPressIn?.(event) }} onPressOut={event => { setPressed(false); onPressOut?.(event) }}
    style={{ minHeight: variant === 'row' ? 52 : metrics.minHeight, minWidth: touchTarget,
      paddingVertical: spacing.sm + 2 - borderWidth, paddingHorizontal: (iconOnly && fontReady ? spacing.sm : variant === 'text' ? spacing.xs : spacing.md) + 2 - borderWidth,
      borderRadius: rounded ? 999 : variant === 'row' ? radii.action : metrics.radius, backgroundColor, borderWidth,
      borderColor: focused ? (variant === 'primary' ? colors.onPrimary : variant === 'destructive' ? colors.onDestructive : colors.focus)
        : variant === 'secondaryDestructive' ? colors.destructive : variant === 'secondary' && !selected ? (outlined ? colors.border : colors.divider) : 'transparent',
      flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: variant === 'row' ? 'flex-start' : 'center' }}>
    {badgeCount !== undefined && Number.isInteger(badgeCount) && badgeCount > 0 && <View testID={props.testID ? `${props.testID}-badge` : undefined}
      pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? { 'aria-hidden': true } : {})}
      style={{ position: 'absolute', right: 0, top: 0, width: spacing.lg, height: spacing.page, borderRadius: radii.control,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="caption" accessible={false} maxFontSizeMultiplier={1.2} style={{ color: colors.onPrimary, ...typography.tab }}>{badgeCount > 9 ? '9+' : String(badgeCount)}</AppText>
    </View>}
    {loading && <ActivityIndicator color={color} accessible={false} />}
    {icon && !loading && (variant === 'row' ? <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.menuIconSurface }}>
      <AppIcon name={icon} size={18} color={colors.primary} />
    </View> : badgeCount !== undefined && iconOnly ? <View style={{ transform: [{ translateX: -spacing.xs }, { translateY: spacing.sm }] }}><AppIcon name={icon} color={color} size={22} /></View> : <AppIcon name={icon} color={color} size={variant === 'text' ? 18 : 22} />)}
    {(!iconOnly || !fontReady) && <AppText variant={metrics.label} maxFontSizeMultiplier={labelMaxFontSizeMultiplier} numberOfLines={labelNumberOfLines}
      style={{ color, textAlign: variant === 'row' ? 'left' : 'center', flexGrow: variant === 'row' ? 1 : 0 }}>{children}</AppText>}
    {variant === 'row' && <AppIcon name="next" color={colors.primary} size={18} />}
  </Pressable>
}
