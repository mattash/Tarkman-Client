import { StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { useI18n } from '../i18n'
import type { SavedDisplayV1 } from '../savedDisplay'
import { colors, radius, safe, space, type } from '../theme'
import { FocusButton } from './FocusButton'
import { ResetControl } from './ResetControl'

/** Opened with Select over a saved church display; Menu or Close returns to it. */
export function SavedDisplayMenu({ saved, onClose, onChange, onBrowse, onSettings, onReset }: {
  saved: SavedDisplayV1
  onClose(): void; onChange(): void; onBrowse(): void; onSettings(): void
  onReset(): Promise<void>
}) {
  const { t } = useI18n()
  return (
    <View testID="saved-display-menu" style={styles.overlay}>
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={styles.panel}>
        <Text style={styles.title} accessibilityRole="header">{t('displayMenu.title')}</Text>
        <Text testID="saved-display-current" style={styles.current}>{t('displayMenu.current', { title: saved.link.title, church: saved.church.name })}</Text>
        <FocusButton testID="menu-change" label={t('savedDisplay.change')} variant="primary" hasTVPreferredFocus onPress={onChange} />
        <FocusButton testID="menu-services" label={t('savedDisplay.services')} onPress={onBrowse} />
        <FocusButton testID="menu-settings" label={t('savedDisplay.settings')} onPress={onSettings} />
        <ResetControl testID="menu-reset" onReset={onReset} />
        <FocusButton testID="menu-close" label={t('displayMenu.close')} onPress={onClose} />
      </TVFocusGuideView>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'flex-end' },
  panel: { width: 900, height: '100%', backgroundColor: colors.surfaceDefault, borderTopLeftRadius: radius, borderBottomLeftRadius: radius, paddingHorizontal: safe.horizontal * 0.8, paddingVertical: safe.vertical, gap: space.md, alignItems: 'flex-start' },
  title: { color: colors.textPrimary, fontSize: type.heading, fontWeight: '700' },
  current: { color: colors.textSecondary, fontSize: type.body },
})
