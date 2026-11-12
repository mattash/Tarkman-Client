import { useId, useState, type ReactNode, type Ref } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget, typography } from '../design/tokens'
import { AppText } from './AppText'

export interface TextFieldProps extends TextInputProps { ref?: Ref<React.ComponentRef<typeof TextInput>>; label: string; error?: string; leading?: ReactNode; trailing?: ReactNode }
/** Label above a 52pt field. The 1pt control outline becomes a 2pt actionPrimary border on focus without moving the text. */
export function TextField({ label, error, leading, trailing, style, onFocus, onBlur, editable = true, keyboardAppearance, ...props }: TextFieldProps) {
  const { colors, scheme } = useTheme()
  const [focused, setFocused] = useState(false)
  const id = useId()
  const borderWidth = focused || error ? 2 : 1
  return <View style={{ gap: 6 }}>
    <AppText nativeID={id} variant="label">{label}</AppText>
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: props.multiline ? 'stretch' : 'center', gap: leading ? spacing.sm : 0, borderRadius: radii.field, borderWidth,
      borderColor: error ? colors.destructive : focused ? colors.primary : colors.border, backgroundColor: colors.surface,
      paddingLeft: 14 + 2 - borderWidth, paddingRight: (trailing ? spacing.xs : 14) + 2 - borderWidth }}>
      {leading}
      <TextInput {...props} editable={editable} allowFontScaling keyboardAppearance={keyboardAppearance ?? scheme} accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={error ?? props.accessibilityHint} accessibilityState={{ ...props.accessibilityState, disabled: !editable }}
        onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
        placeholderTextColor={colors.muted} selectionColor={colors.primary}
        style={[typography.body, { flex: 1, minHeight: touchTarget, color: colors.foreground, paddingVertical: spacing.sm, textAlignVertical: 'top' }, style]} />
      {trailing}
    </View>
    {error && <AppText tone="destructive" variant="caption" accessibilityRole="alert">{error}</AppText>}
  </View>
}
