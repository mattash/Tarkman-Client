import { useState } from 'react'
import { Platform, Pressable } from 'react-native'
import type { Language } from '@tarkman/core'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../design/tokens'
import { AppIcon } from './AppIcon'
import { AppText } from './AppText'

export function LanguageSelectionRow({ label, language, selected, multiple = false, onPress }: {
  label: string; language: Language; selected: boolean; multiple?: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'button'} accessibilityLabel={label}
    accessibilityHint={multiple ? selected ? 'Double tap to remove this language' : 'Double tap to add this language' : undefined}
    {...(Platform.OS === 'web' ? multiple ? { 'aria-checked': selected } : { 'aria-selected': selected } : {})}
    accessibilityState={multiple ? { checked: selected, selected } : { selected }} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control,
      borderBottomWidth: 1, borderBottomColor: colors.divider,
      backgroundColor: pressed ? colors.pressedSubtle : selected ? colors.secondary : colors.overlay }}>
    <AppText language={language} style={{ flex: 1, color: pressed ? colors.foreground : selected ? colors.onSecondary : colors.foreground }}>{label}</AppText>
    {(selected || multiple) && <AppIcon name={multiple ? selected ? 'checkbox' : 'unchecked' : 'selected'} color={pressed ? colors.foreground : selected ? colors.onSecondary : colors.muted} />}
  </Pressable>
}
