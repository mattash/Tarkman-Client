import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { LANGUAGES } from '@tarkman/core'
import { FocusButton } from '../components/FocusButton'
import { INTERFACE_LANGUAGES, useI18n } from '../i18n'
import { usePreferences } from '../preferences'
import { colors, safe, space, TEXT_SIZES, type } from '../theme'

export function SettingsScreen({ onDone }: { onDone(): void }) {
  const { t, language, setLanguage } = useI18n()
  const { readingLanguage, setReadingLanguage, textSize, setTextSize } = usePreferences()
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">{t('settings.title')}</Text>
      <Row label={t('settings.readingLanguage')}>
        {LANGUAGES.map(({ value }, index) => (
          <FocusButton key={value} testID={`setting-reading-${value}`} label={t(`languageNames.${value}`)} selected={value === readingLanguage}
            hasTVPreferredFocus={index === 0} onPress={() => setReadingLanguage(value)} />
        ))}
      </Row>
      <Row label={t('settings.textSize')}>
        {TEXT_SIZES.map(size => (
          <FocusButton key={size} testID={`setting-size-${size}`} label={t(`settings.${size}`)} selected={size === textSize} onPress={() => setTextSize(size)} />
        ))}
      </Row>
      <Row label={t('settings.interfaceLanguage')}>
        {INTERFACE_LANGUAGES.map(value => (
          <FocusButton key={value} testID={`setting-interface-${value}`} label={t(`interfaceLanguages.${value}`)} selected={value === language} onPress={() => setLanguage(value)} />
        ))}
      </Row>
      <View style={styles.done}><FocusButton testID="settings-done" label={t('settings.done')} variant="primary" onPress={onDone} /></View>
    </ScrollView>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TVFocusGuideView autoFocus style={styles.options}>{children}</TVFocusGuideView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas },
  content: { paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.lg },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  row: { gap: space.sm },
  label: { color: colors.textSecondary, fontSize: type.body },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingVertical: space.xs },
  done: { flexDirection: 'row', marginTop: space.md },
})
