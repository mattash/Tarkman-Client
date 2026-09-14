import type { Language } from '@tarkman/core'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppButton } from '../../../../components/AppButton'
import { AppText } from '../../../../components/AppText'
import { useTheme } from '../../../../design/ThemeProvider'
import { spacing, touchTarget } from '../../../../design/tokens'
import { sampleLanguages } from '../../../../design/samples'
import { LANGUAGES, MAX_CONTROL_LANGUAGES, resolveControlLanguages, SPOKEN_LANGUAGE, usePreferences } from '../../../../features/preferences/PreferencesProvider'

/** Which languages service control shows, and in what order. Saved on this device; the reading screen keeps its own languages. */
export default function ControlLanguagesSheet() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { preferences, setControlLanguages } = usePreferences()
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
      <AppText variant="heading" style={{ flex: 1 }}>Languages</AppText>
      <AppButton variant="quiet" accessibilityLabel="Close Languages" onPress={() => router.back()}>Done</AppButton>
    </View>
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <AppText variant="caption" tone="muted">{`Choose up to ${MAX_CONTROL_LANGUAGES} languages for service control, in the order you read them. The first is marked as the one you read from. Your reading screen keeps its own languages.`}</AppText>

      <AppText variant="eyebrow" tone="muted">SHOWN, IN ORDER</AppText>
      <View>
        {chosen.map((language, index) => <View key={language} testID={`control-language-${language}`}
          style={{ minHeight: touchTarget + spacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs,
            borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.xs }}>
          <AppText variant="label" tone="muted" accessibilityElementsHidden importantForAccessibility="no" style={{ minWidth: 20 }}>{String(index + 1)}</AppText>
          <View accessible accessibilityLabel={`${SPOKEN_LANGUAGE[language]}, ${index + 1} of ${chosen.length}${index === 0 ? ', read from' : ''}`} style={{ flex: 1, minWidth: 120 }}>
            <AppText language={language}>{native(language)}</AppText>
            {index === 0 && <AppText variant="caption" tone="muted">Read from</AppText>}
          </View>
          <AppButton variant="quiet" icon="up" iconOnly disabled={index === 0} accessibilityLabel={`Move ${SPOKEN_LANGUAGE[language]} up`}
            onPress={() => move(index, index - 1)}>Move up</AppButton>
          <AppButton variant="quiet" icon="down" iconOnly disabled={index === chosen.length - 1} accessibilityLabel={`Move ${SPOKEN_LANGUAGE[language]} down`}
            onPress={() => move(index, index + 1)}>Move down</AppButton>
          <AppButton variant="quiet" icon="close" iconOnly disabled={chosen.length === 1} accessibilityLabel={`Remove ${SPOKEN_LANGUAGE[language]}`}
            accessibilityHint={chosen.length === 1 ? 'Service control keeps at least one language.' : undefined}
            onPress={() => setControlLanguages(chosen.filter(item => item !== language))}>Remove</AppButton>
        </View>)}
      </View>

      {available.length > 0 && <>
        <AppText variant="eyebrow" tone="muted" style={{ marginTop: spacing.md }}>ADD A LANGUAGE</AppText>
        {full && <AppText variant="caption" tone="muted">{`Service control shows up to ${MAX_CONTROL_LANGUAGES}. Remove one to add another.`}</AppText>}
        <View>
          {available.map(language => <View key={language} style={{ minHeight: touchTarget + spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.xs }}>
            <AppText language={language} style={{ flex: 1 }}>{native(language)}</AppText>
            <AppButton variant="secondary" disabled={full} accessibilityLabel={`Add ${SPOKEN_LANGUAGE[language]}`}
              onPress={() => setControlLanguages([...chosen, language])}>Add</AppButton>
          </View>)}
        </View>
      </>}
    </View>
  </ScrollView>
}
