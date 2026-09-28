import { StyleSheet, Text, View } from 'react-native'
import { FocusButton } from '../components/FocusButton'
import { useI18n } from '../i18n'
import { colors, safe, space, type } from '../theme'

/** The separate, discoverable entry for a saved church display. Its flow arrives with #215. */
export function DisplaySetupScreen({ onBack }: { onBack(): void }) {
  const { t } = useI18n()
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">{t('displaySetup.title')}</Text>
      <Text testID="display-setup-body" style={styles.body}>{t('displaySetup.body')}</Text>
      <View style={styles.actions}><FocusButton testID="display-setup-back" label={t('displaySetup.back')} variant="primary" hasTVPreferredFocus onPress={onBack} /></View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.lg },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: type.heading, maxWidth: 1400 },
  actions: { flexDirection: 'row' },
})
