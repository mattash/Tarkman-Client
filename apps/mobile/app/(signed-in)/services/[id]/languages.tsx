import type { Language } from '@tarkman/core'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppButton } from '../../../../components/AppButton'
import { AppText } from '../../../../components/AppText'
import { useTheme } from '../../../../design/ThemeProvider'
import { spacing, touchTarget } from '../../../../design/tokens'
import { sampleLanguages } from '../../../../design/samples'
import { LANGUAGES, MAX_CONTROL_LANGUAGES, resolveControlLanguages, usePreferences } from '../../../../features/preferences/PreferencesProvider'
import { useI18n } from '../../../../features/i18n'

/** Which languages service control shows, and in what order. Saved on this device; the reading screen keeps its own languages. */
export default function ControlLanguagesSheet() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { preferences, setControlLanguages } = usePreferences()
  const { t } = useI18n()
  const spoken = (language: Language) => t(`languageNames.${language}`)
  const chosen = resolveControlLanguages(preferences)
  const available = LANGUAGES.filter(item => !chosen.includes(item))
  const full = chosen.length >= MAX_CONTROL_LANGUAGES
  const native = (language: Language) => sampleLanguages.find(item => item.value === language)?.label ?? language
  const move = (from: number, to: number) => {
    const next = [...chosen]
    const [language] = next.splice(from, 1)
    next.splice(to, 0, language)
    setControlLanguages(next)
  }

  // The scroll view is the sheet's root, so the native form sheet cannot draw it over the title row.
  return <ScrollView testID="control-languages-sheet" style={{ flex: 1, backgroundColor: colors.overlay }} stickyHeaderIndices={[0]}
    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm,
      paddingHorizontal: spacing.lg, backgroundColor: colors.overlay }}>
      <AppText variant="heading" style={{ flex: 1 }}>{t('common.languages')}</AppText>
      <AppButton variant="quiet" accessibilityLabel={t('common.closeTitle', { title: t('common.languages') })} onPress={() => router.back()}>{t('common.done')}</AppButton>
    </View>
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <AppText variant="caption" tone="muted">{t('controlLanguages.intro', { count: MAX_CONTROL_LANGUAGES })}</AppText>

      <AppText variant="eyebrow" tone="muted">{t('controlLanguages.shownInOrder')}</AppText>
      <View>
        {chosen.map((language, index) => <View key={language} testID={`control-language-${language}`}
          style={{ minHeight: touchTarget + spacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs,
            borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.xs }}>
          <AppText variant="label" tone="muted" accessibilityElementsHidden importantForAccessibility="no" style={{ minWidth: 20 }}>{String(index + 1)}</AppText>
          <View accessible accessibilityLabel={t(index === 0 ? 'controlLanguages.rowLabelFirst' : 'controlLanguages.rowLabel', { language: spoken(language), index: index + 1, count: chosen.length })} style={{ flex: 1, minWidth: 120 }}>
            <AppText language={language}>{native(language)}</AppText>
            {index === 0 && <AppText variant="caption" tone="muted">{t('controlLanguages.readFrom')}</AppText>}
          </View>
          <AppButton variant="quiet" icon="up" iconOnly disabled={index === 0} accessibilityLabel={t('controlLanguages.moveUpLabel', { language: spoken(language) })}
            onPress={() => move(index, index - 1)}>{t('controlLanguages.moveUp')}</AppButton>
          <AppButton variant="quiet" icon="down" iconOnly disabled={index === chosen.length - 1} accessibilityLabel={t('controlLanguages.moveDownLabel', { language: spoken(language) })}
            onPress={() => move(index, index + 1)}>{t('controlLanguages.moveDown')}</AppButton>
          <AppButton variant="quiet" icon="close" iconOnly disabled={chosen.length === 1} accessibilityLabel={t('controlLanguages.removeLabel', { language: spoken(language) })}
            accessibilityHint={chosen.length === 1 ? t('controlLanguages.removeHint') : undefined}
            onPress={() => setControlLanguages(chosen.filter(item => item !== language))}>{t('controlLanguages.remove')}</AppButton>
        </View>)}
      </View>

      {available.length > 0 && <>
        <AppText variant="eyebrow" tone="muted" style={{ marginTop: spacing.md }}>{t('controlLanguages.addALanguage')}</AppText>
        {full && <AppText variant="caption" tone="muted">{t('controlLanguages.full', { count: MAX_CONTROL_LANGUAGES })}</AppText>}
        <View>
          {available.map(language => <View key={language} style={{ minHeight: touchTarget + spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.xs }}>
            <AppText language={language} style={{ flex: 1 }}>{native(language)}</AppText>
            <AppButton variant="secondary" disabled={full} accessibilityLabel={t('controlLanguages.addLabel', { language: spoken(language) })}
              onPress={() => setControlLanguages([...chosen, language])}>{t('controlLanguages.add')}</AppButton>
          </View>)}
        </View>
      </>}
    </View>
  </ScrollView>
}
