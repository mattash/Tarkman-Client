import { useState } from 'react'
import { Platform, Pressable } from 'react-native'
import type { Language } from '@tarkman/core'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../design/tokens'
import { AppIcon } from './AppIcon'
import { AppText } from './AppText'
import { useI18n } from '../features/i18n'

export function LanguageSelectionRow({ label, language, selected, multiple = false, disabled = false, onPress }: {
  label: string; language: Language; selected: boolean; multiple?: boolean
  /** Unavailable for now, for example when the most languages are already chosen. */
  disabled?: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [pressed, setPressed] = useState(false)
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'button'} accessibilityLabel={label}
    accessibilityHint={multiple ? selected ? t('languageRow.removeHint') : t('languageRow.addHint') : undefined}
    {...(Platform.OS === 'web' ? multiple ? { 'aria-checked': selected } : { 'aria-selected': selected } : {})}
    accessibilityState={multiple ? { checked: selected, selected, disabled } : { selected, disabled }} disabled={disabled} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control,
      borderBottomWidth: 1, borderBottomColor: colors.divider,
      backgroundColor: pressed ? colors.pressedSubtle : selected ? colors.secondary : colors.overlay }}>
    <AppText language={language} style={{ flex: 1, color: disabled ? colors.onDisabled : pressed ? colors.foreground : selected ? colors.onSecondary : colors.foreground }}>{label}</AppText>
    {(selected || multiple) && <AppIcon name={multiple ? selected ? 'checkbox' : 'unchecked' : 'selected'} color={disabled ? colors.onDisabled : pressed ? colors.foreground : selected ? colors.onSecondary : colors.muted} />}
  </Pressable>
}
