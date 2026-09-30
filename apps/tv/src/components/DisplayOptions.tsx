import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { TEXT_MOVEMENTS, type DisplayLanguage, type DisplayPreferences } from '@tarkman/reader'
import { useI18n, type MessageKey } from '../i18n'
import { usePreferences } from '../preferences'
import { colors, glassRadius, safe, space, type } from '../theme'
import { FocusButton } from './FocusButton'
import { Glass } from './Glass'

const LANGUAGES: DisplayLanguage[] = ['translit', 'en', 'hyw', 'grabar']
const SCALES = [75, 100, 125, 150]
const STATUS_VIEWS: DisplayPreferences['status_view'][] = ['full', 'pages_only', 'posture_only', 'none']
const languageKey = (language: DisplayLanguage): MessageKey => `languageNames.${language}`

/** The display-link settings a viewer can change from the couch, with mobile's wording. */
export function DisplayOptionRows({ first = false }: { first?: boolean }) {
  const { t } = useI18n()
  const { display, updateDisplay } = usePreferences()
  const scale = display.font_scale ?? 100
  const movement = display.text_movement ?? 'continuous'
  return (
    <>
      <Row label={t('displayOptions.lang1')}>
        {LANGUAGES.map((language, index) => (
          <FocusButton key={language} testID={`option-lang1-${language}`} label={t(languageKey(language))} selected={display.lang1 === language}
            hasTVPreferredFocus={first && index === 0} onPress={() => updateDisplay({ lang1: language })} />
        ))}
      </Row>
      <Row label={t('displayOptions.mode')}>
        {(['parallel', 'single'] as const).map(mode => (
          <FocusButton key={mode} testID={`option-mode-${mode}`} label={t(`displayOptions.${mode}`)} selected={display.mode === mode}
            onPress={() => updateDisplay({ mode, lang2: mode === 'parallel' ? display.lang2 ?? LANGUAGES.find(l => l !== display.lang1) : display.lang2 })} />
        ))}
      </Row>
      {display.mode === 'parallel' ? (
        <Row label={t('displayOptions.lang2')}>
          {LANGUAGES.filter(language => language !== display.lang1).map(language => (
            <FocusButton key={language} testID={`option-lang2-${language}`} label={t(languageKey(language))} selected={display.lang2 === language}
              onPress={() => updateDisplay({ lang2: language })} />
          ))}
        </Row>
      ) : null}
      <Row label={t('displayOptions.font_scale')}>
        {SCALES.map(value => (
          <FocusButton key={value} testID={`option-scale-${value}`} label={t('displayOptions.fontValue', { value })} selected={scale === value}
            onPress={() => updateDisplay({ font_scale: value })} />
        ))}
      </Row>
      <Row label={t('displayOptions.text_movement')}>
        {TEXT_MOVEMENTS.map(value => (
          <FocusButton key={value} testID={`option-movement-${value}`} label={t(value === 'none' ? 'displayOptions.movementNone' : `displayOptions.${value}`)}
            selected={movement === value} onPress={() => updateDisplay({ text_movement: value })} />
        ))}
      </Row>
      <Row label={t('displayOptions.status_view')}>
        {STATUS_VIEWS.map(value => (
          <FocusButton key={value} testID={`option-status-${value}`} label={t(`displayOptions.${value}`)} selected={display.status_view === value}
            onPress={() => updateDisplay({ status_view: value })} />
        ))}
      </Row>
    </>
  )
}

/** Opened with Select over a running display; Menu or Close returns to it. */
export function DisplayOptions({ onClose, onBack }: { onClose(): void; onBack(): void }) {
  const { t } = useI18n()
  return (
    <View testID="display-options" style={styles.overlay}>
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={styles.panel}>
        <Glass radius={glassRadius.panel} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title} accessibilityRole="header">{t('displayOptions.title')}</Text>
          <DisplayOptionRows first />
          <View style={styles.actions}>
            <FocusButton testID="options-close" label={t('displayOptions.close')} variant="primary" onPress={onClose} />
            <FocusButton testID="options-back" label={t('displayOptions.backToServices')} onPress={onBack} />
          </View>
        </ScrollView>
      </TVFocusGuideView>
    </View>
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
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'flex-end' },
  // A floating glass panel, not flush to the edge: its rounded corners show, and the dim overlay keeps light
  // projection text from washing out the glass.
  panel: { width: 1100, height: '92%', marginRight: space.lg },
  content: { paddingHorizontal: safe.horizontal * 0.8, paddingVertical: safe.vertical, gap: space.md },
  title: { color: colors.textPrimary, fontSize: type.heading, fontWeight: '700' },
  row: { gap: space.xs },
  label: { color: colors.textSecondary, fontSize: type.caption },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
})
