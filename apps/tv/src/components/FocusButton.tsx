import { forwardRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native'
import { colors, focusSurface, glassRadius, space, type } from '../theme'
import { Glass } from './Glass'

export interface FocusButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string
  detail?: string
  selected?: boolean
  variant?: 'primary' | 'secondary' | 'card'
  /** Destructive actions read pink at rest and dark red on the white focus surface. */
  tone?: 'destructive'
  /** A trailing element (a status chip); it may depend on focus. */
  accessory?: ReactNode | ((focused: boolean) => ReactNode)
  testID?: string
}

/**
 * A remote-focusable control. At rest it is glass; on focus it lifts, brightens and gains a soft ring, so
 * focus is always visible from across the room. Primary is a solid accent; selected is a tinted glass.
 */
export const FocusButton = forwardRef<ViewType, FocusButtonProps>(function FocusButton({ label, detail, selected = false, variant = 'secondary', tone, accessory, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false)
  const primary = variant === 'primary'
  const card = variant === 'card'
  const radius = card ? glassRadius.card : glassRadius.pill
  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ selected }} {...props}
      onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
      style={[styles.base, card ? styles.card : styles.pill, { borderRadius: radius }, focused && [styles.focused, { borderRadius: radius }]]}>
      {focused ? null : primary ? <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.actionPrimary }]} />
        : <Glass radius={radius} style={StyleSheet.absoluteFill} />}
      {selected && !focused ? <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.selection, opacity: 0.85 }]} /> : null}
      <View style={styles.row}>
        <View style={[styles.text, accessory ? styles.textGrow : null]}>
          <Text numberOfLines={card ? 2 : 1} style={[styles.label, card && styles.cardLabel, primary && styles.onPrimary, selected && styles.onSelection, tone === 'destructive' && styles.destructive, focused && (tone === 'destructive' ? styles.onFocusDanger : styles.onFocus)]}>{label}</Text>
          {detail ? <Text numberOfLines={2} style={[styles.detail, focused && styles.onFocusDetail]}>{detail}</Text> : null}
        </View>
        {typeof accessory === 'function' ? accessory(focused) : accessory}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flexShrink: 1, minWidth: 0 },
  textGrow: { flexGrow: 1 },
  base: { borderWidth: 4, borderColor: 'transparent', justifyContent: 'center' },
  pill: { paddingHorizontal: space.lg, paddingVertical: space.sm + 4 },
  card: { paddingHorizontal: space.lg + 8, paddingVertical: space.md + 4 },
  focused: { backgroundColor: focusSurface.background, borderColor: focusSurface.ring, transform: [{ scale: 1.05 }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 24 } },
  label: { color: colors.textPrimary, fontSize: type.label, fontWeight: '600' },
  cardLabel: { fontSize: type.body },
  detail: { color: colors.textSecondary, fontSize: type.caption, marginTop: space.xs },
  onPrimary: { color: colors.actionOnPrimary },
  onSelection: { color: colors.onSelection },
  destructive: { color: colors.danger },
  onFocus: { color: focusSurface.text },
  onFocusDanger: { color: focusSurface.danger },
  onFocusDetail: { color: focusSurface.text, opacity: 0.7 },
})
