import { forwardRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native'
import { colors, radius, space, type } from '../theme'

export interface FocusButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  detail?: string
  selected?: boolean
  variant?: 'primary' | 'secondary' | 'card'
  testID?: string
}

/** A remote-focusable control. Focus is always visible: a raised, outlined surface. */
export const FocusButton = forwardRef<ViewType, FocusButtonProps>(function FocusButton({ label, detail, selected = false, variant = 'secondary', onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false)
  const primary = variant === 'primary'
  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ selected }} {...props}
      onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
      style={[styles.base, variant === 'card' && styles.card, primary && styles.primary, selected && styles.selected, focused && styles.focused]}>
      <View>
        <Text numberOfLines={variant === 'card' ? 2 : 1} style={[styles.label, variant === 'card' && styles.cardLabel, primary && styles.onPrimary, selected && styles.onSelection, focused && styles.onFocus]}>{label}</Text>
        {detail ? <Text numberOfLines={2} style={[styles.detail, focused && styles.onFocus]}>{detail}</Text> : null}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  base: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius, backgroundColor: colors.surfaceRaised, borderWidth: 4, borderColor: 'transparent' },
  card: { paddingHorizontal: space.lg, paddingVertical: space.md },
  primary: { backgroundColor: colors.actionPrimary },
  selected: { backgroundColor: colors.selection },
  focused: { backgroundColor: colors.textPrimary, borderColor: colors.focus, transform: [{ scale: 1.06 }] },
  label: { color: colors.textPrimary, fontSize: type.label, fontWeight: '600' },
  cardLabel: { fontSize: type.body },
  detail: { color: colors.textSecondary, fontSize: type.caption, marginTop: space.xs },
  onPrimary: { color: colors.actionOnPrimary },
  onSelection: { color: colors.onSelection },
  onFocus: { color: colors.surfaceCanvas },
})
