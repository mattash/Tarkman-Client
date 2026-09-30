import { StyleSheet, Text, View } from 'react-native'
import { FocusButton } from '../components/FocusButton'
import { ResetControl } from '../components/ResetControl'
import { StatusIcon, type StatusIconName } from '../components/StatusIcon'
import { useI18n } from '../i18n'
import { colors, safe, space, type } from '../theme'

const ICONS: Record<'corrupt' | 'newer' | 'unavailable', StatusIconName> = { corrupt: 'warning', newer: 'update', unavailable: 'lock' }

/**
 * The saved display exists but cannot be used (damaged, written by a newer app, or the Keychain could not
 * be read). It is explained and left in place. A damaged or newer record can be set up again (which
 * replaces it on save) or erased; an unreadable Keychain is only retried, since the record may be fine.
 */
export function SavedProblemScreen({ reason, onSetup, onErase, onServices, onRetry }: {
  reason: 'corrupt' | 'newer' | 'unavailable'
  onRetry(): void
  onSetup(): void
  onErase(): Promise<void>
  onServices(): void
}) {
  const { t } = useI18n()
  return (
    <View style={styles.screen}>
      <StatusIcon name={ICONS[reason]} />
      <Text style={styles.title} accessibilityRole="header">{t('savedProblem.title')}</Text>
      <Text testID="saved-problem-reason" style={styles.body}>{t(`savedProblem.${reason}`)}</Text>
      {reason === 'unavailable' ? (
        <View style={styles.actions}>
          <FocusButton testID="problem-retry" label={t('savedProblem.retry')} variant="primary" hasTVPreferredFocus onPress={onRetry} />
          <FocusButton testID="problem-services" label={t('savedProblem.services')} onPress={onServices} />
        </View>
      ) : (
        <View style={styles.actions}>
          <FocusButton testID="problem-setup" label={t('savedProblem.setup')} variant="primary" hasTVPreferredFocus onPress={onSetup} />
          <FocusButton testID="problem-services" label={t('savedProblem.services')} onPress={onServices} />
          <ResetControl testID="problem-erase" label={t('savedProblem.erase')} onReset={onErase} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.lg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.textSecondary, fontSize: type.heading, maxWidth: 1200, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', justifyContent: 'center', marginTop: space.md },
})
