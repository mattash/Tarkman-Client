import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { DisplayOptionRows } from '../components/DisplayOptions'
import { FocusButton } from '../components/FocusButton'
import { Glass } from '../components/Glass'
import { ScreenHeader } from '../components/ScreenHeader'
import { ResetControl } from '../components/ResetControl'
import { INTERFACE_LANGUAGES, useI18n } from '../i18n'
import { useSavedDisplay } from '../saved'
import { colors, glassRadius, safe, space, type } from '../theme'

export function SettingsScreen({ onDone, onChangeDisplay, onReset }: { onDone(): void; onChangeDisplay(): void; onReset(): Promise<void> }) {
  const { t, language, setLanguage } = useI18n()
  const { load } = useSavedDisplay()
  const saved = load.kind === 'saved' ? load.record : null
  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('settings.title')} />
      <View style={styles.panel}>
        <Glass radius={glassRadius.panel} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('settings.churchDisplay')}</Text>
            <Text testID="settings-church-display" style={styles.value}>
              {saved ? t('settings.churchDisplayCurrent', { title: saved.link.title, church: saved.church.name }) : t('settings.churchDisplayNone')}
            </Text>
            <View style={styles.options}>
              <FocusButton testID="settings-change-display" label={t('settings.changeChurchDisplay')} onPress={onChangeDisplay} />
              {saved ? <ResetControl testID="settings-reset" onReset={onReset} /> : null}
            </View>
          </View>
          <DisplayOptionRows first />
          <View style={styles.row}>
            <Text style={styles.label}>{t('settings.interfaceLanguage')}</Text>
            <TVFocusGuideView autoFocus style={styles.options}>
              {INTERFACE_LANGUAGES.map(value => (
                <FocusButton key={value} testID={`setting-interface-${value}`} label={t(`interfaceLanguages.${value}`)} selected={value === language} onPress={() => setLanguage(value)} />
              ))}
            </TVFocusGuideView>
          </View>
          <View style={styles.done}><FocusButton testID="settings-done" label={t('settings.done')} variant="primary" onPress={onDone} /></View>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.md },
  panel: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.md },
  row: { gap: space.xs },
  label: { color: colors.textSecondary, fontSize: type.caption },
  value: { color: colors.textPrimary, fontSize: type.body },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.xs },
  done: { flexDirection: 'row', marginTop: space.md },
})
