import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { DisplayOptionRows } from '../components/DisplayOptions'
import { FocusButton } from '../components/FocusButton'
import { ResetControl } from '../components/ResetControl'
import { INTERFACE_LANGUAGES, useI18n } from '../i18n'
import { useSavedDisplay } from '../saved'
import { colors, safe, space, type } from '../theme'

export function SettingsScreen({ onDone, onChangeDisplay, onReset }: { onDone(): void; onChangeDisplay(): void; onReset(): Promise<void> }) {
  const { t, language, setLanguage } = useI18n()
  const { load } = useSavedDisplay()
  const saved = load.kind === 'saved' ? load.record : null
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">{t('settings.title')}</Text>
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
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas },
  content: { paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical, gap: space.md },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  row: { gap: space.xs },
  label: { color: colors.textSecondary, fontSize: type.caption },
  value: { color: colors.textPrimary, fontSize: type.body },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.xs },
  done: { flexDirection: 'row', marginTop: space.md },
})
