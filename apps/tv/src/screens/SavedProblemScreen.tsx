import { StyleSheet, Text, View } from 'react-native'
import { FocusButton } from '../components/FocusButton'
import { ResetControl } from '../components/ResetControl'
import { useI18n } from '../i18n'
import { colors, safe, space, type } from '../theme'

/**
 * The saved display exists but cannot be used (damaged, or written by a newer app). It is explained and
 * left in place; the viewer chooses to set up again (which replaces it on save) or to erase it.
 */
export function SavedProblemScreen({ reason, onSetup, onErase, onServices }: {
  reason: 'corrupt' | 'newer'
  onSetup(): void
  onErase(): Promise<void>
  onServices(): void
}) {
  const { t } = useI18n()
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">{t('savedProblem.title')}</Text>
      <Text testID="saved-problem-reason" style={styles.body}>{t(`savedProblem.${reason}`)}</Text>
      <View style={styles.actions}>
        <FocusButton testID="problem-setup" label={t('savedProblem.setup')} variant="primary" hasTVPreferredFocus onPress={onSetup} />
        <FocusButton testID="problem-services" label={t('savedProblem.services')} onPress={onServices} />
        <ResetControl testID="problem-erase" label={t('savedProblem.erase')} onReset={onErase} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.lg },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: type.heading, maxWidth: 1400 },
  actions: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
})
