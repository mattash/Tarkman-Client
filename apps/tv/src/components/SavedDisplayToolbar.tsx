import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'
import type { SavedDisplayV1 } from '../savedDisplay'
import { colors, safe, space, type } from '../theme'
import { FocusButton } from './FocusButton'
import { ResetControl } from './ResetControl'

/**
 * Always shown under a running saved church display. Everything that changes or leaves the display
 * lives here; Menu (Back) is the way out of the app, so nothing else on screen needs a key.
 */
export function SavedDisplayToolbar({ saved, onChange, onBrowse, onSettings, onReset, onLayoutHeight }: {
  saved: SavedDisplayV1
  onChange(): void; onBrowse(): void; onSettings(): void
  onReset(): Promise<void>
  onLayoutHeight?(height: number): void
}) {
  const { t } = useI18n()
  return (
    <View testID="saved-display-toolbar" style={styles.bar} onLayout={event => onLayoutHeight?.(event.nativeEvent.layout.height)}>
      <Text testID="saved-display-current" numberOfLines={1} style={styles.current}>{t('displayMenu.current', { title: saved.link.title, church: saved.church.name })}</Text>
      <View style={styles.actions}>
        <FocusButton testID="toolbar-services" label={t('savedDisplay.services')} onPress={onBrowse} />
        <FocusButton testID="toolbar-settings" label={t('savedDisplay.settings')} onPress={onSettings} />
        <FocusButton testID="toolbar-change" label={t('savedDisplay.change')} onPress={onChange} />
        <ResetControl testID="toolbar-reset" onReset={onReset} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, backgroundColor: colors.surfaceDefault,
    paddingHorizontal: safe.horizontal, paddingVertical: space.sm },
  current: { flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: type.caption },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
})
