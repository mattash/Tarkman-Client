import { useState, type Ref } from 'react'
import { ActivityIndicator, Pressable, View, type DimensionValue } from 'react-native'
import { AppIcon, type IconName } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing, typography } from '../../design/tokens'

export interface ControlButtonProps {
  ref?: Ref<React.ComponentRef<typeof View>>
  label: string
  accessibilityLabel?: string
  accessibilityHint?: string
  testID?: string
  variant?: 'primary' | 'bordered'
  /** Minimum height; the label may still grow it at large text sizes. */
  height: number
  width?: DimensionValue
  /** Grows past this width rather than breaking its label mid-word, as Back does beside a flexing Next. */
  minWidth?: DimensionValue
  flex?: number
  icon?: IconName
  iconOnly?: boolean
  labelVariant?: keyof typeof typography
  selected?: boolean
  /** This control's command is in flight: a spinner replaces the label at unchanged size. */
  sending?: boolean
  /** Another command is in flight, or the device is offline. Drops to 56% and keeps its border, never disabled styling. */
  held?: boolean
  /** Not available for its own reasons (for example an empty announcement): disabled tokens apply. */
  unavailable?: boolean
  onPress(): void
}

/** A service control. Nothing moves while a command runs: sizes, borders and positions stay put. */
export function ControlButton({ ref, label, accessibilityLabel, accessibilityHint, testID, variant = 'bordered', height, width, flex, icon, iconOnly = false,
  minWidth, labelVariant = 'action', selected = false, sending = false, held = false, unavailable = false, onPress }: ControlButtonProps) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  const filled = variant === 'primary' || selected
  const inactive = sending || held || unavailable
  const backgroundColor = unavailable ? colors.disabled : pressed ? (filled ? colors.pressed : colors.pressedSubtle) : filled ? colors.primary : colors.surface
  const color = unavailable ? colors.onDisabled : filled ? colors.onPrimary : colors.foreground
  return <Pressable ref={ref} testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint}
    accessibilityState={{ selected, disabled: inactive, busy: sending }} disabled={inactive} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: height, width, minWidth, flex, opacity: held ? 0.56 : 1, borderRadius: radii.action, borderWidth: 1,
      borderColor: filled && !unavailable ? backgroundColor : colors.border, backgroundColor,
      paddingHorizontal: iconOnly || minWidth !== undefined ? spacing.sm : spacing.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
    {/* The label stays laid out but invisible while sending, so the control keeps its size. */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: minWidth !== undefined ? spacing.xs : spacing.sm, opacity: sending ? 0 : 1 }}>
      {icon && <AppIcon name={icon} color={color} size={iconOnly ? 28 : 22} />}
      {!iconOnly && <AppText variant={labelVariant} accessibilityRole="none" style={{ color, textAlign: 'center', ...(minWidth !== undefined ? { flexShrink: 0 } : {}) }}>{label}</AppText>}
    </View>
    {sending && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={color} accessible={false} />
    </View>}
  </Pressable>
}
