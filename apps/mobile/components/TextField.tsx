import { useId, useState, type Ref } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget, typography } from '../design/tokens'
import { AppText } from './AppText'

export interface TextFieldProps extends TextInputProps { ref?: Ref<TextInput>; label: string; error?: string }
export function TextField({ label, error, style, onFocus, onBlur, editable = true, ...props }: TextFieldProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const id = useId()
  return <View style={{ gap: spacing.sm }}>
    <AppText nativeID={id} variant="label">{label}</AppText>
    <TextInput {...props} editable={editable} allowFontScaling accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityHint={error ?? props.accessibilityHint} accessibilityState={{ ...props.accessibilityState, disabled: !editable }}
      onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
      placeholderTextColor={colors.muted} selectionColor={colors.primary}
      style={[typography.body, { minHeight: touchTarget, minWidth: touchTarget, borderRadius: radii.control, borderWidth: 2,
        borderColor: error ? colors.destructive : focused ? colors.focus : colors.border, color: colors.foreground,
        backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlignVertical: 'top' }, style]} />
    {error && <AppText tone="destructive" variant="caption" accessibilityRole="alert">{error}</AppText>}
  </View>
}
