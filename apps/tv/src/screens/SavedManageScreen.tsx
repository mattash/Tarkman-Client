import { StyleSheet, Text, View } from 'react-native'
import { FocusButton } from '../components/FocusButton'
import { Glass } from '../components/Glass'
import { ResetControl } from '../components/ResetControl'
import { useI18n } from '../i18n'
import type { SavedDisplayV1 } from '../savedDisplay'
import { colors, glassRadius, safe, space, type } from '../theme'

/**
 * Where Back from a running saved display lands. The display itself shows nothing but its content, so
 * changing, browsing and resetting live here; Back returns to the display.
 */
export function SavedManageScreen({ saved, onChange, onBrowse, onSettings, onReset }: {
  saved: SavedDisplayV1
  onChange(): void; onBrowse(): void; onSettings(): void
  onReset(): Promise<void>
}) {
  const { t } = useI18n()
  return (
    <View testID="saved-display-manage" style={styles.screen}>
      <Glass radius={glassRadius.panel} style={styles.panel}>
      <Text style={styles.title} accessibilityRole="header">{t('displayMenu.title')}</Text>
      <Text testID="saved-display-current" style={styles.current}>{t('displayMenu.current', { title: saved.link.title, church: saved.church.name })}</Text>
      <View style={styles.actions}>
        <FocusButton testID="manage-change" label={t('savedDisplay.change')} variant="primary" hasTVPreferredFocus onPress={onChange} />
        <FocusButton testID="manage-services" label={t('savedDisplay.services')} onPress={onBrowse} />
        <FocusButton testID="manage-settings" label={t('savedDisplay.settings')} onPress={onSettings} />
        <ResetControl testID="manage-reset" onReset={onReset} />
      </View>
      </Glass>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.md, justifyContent: 'center', alignItems: 'center' },
  panel: { width: 960, padding: space.xl, gap: space.md },
  title: { color: colors.textPrimary, fontSize: type.heading, fontWeight: '700' },
  current: { color: colors.textSecondary, fontSize: type.body },
  actions: { gap: space.md, alignItems: 'flex-start', marginTop: space.md },
})
