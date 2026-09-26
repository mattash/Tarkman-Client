import { LibraryManagement } from '../library/LibraryManagement'
import { Help } from '../onboarding/Help'
import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { LanguageSelectionRow } from '../../components/LanguageSelectionRow'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StatusPill } from '../../components/StatusPill'
import { useTheme } from '../../design/ThemeProvider'
import { sampleLanguages } from '../../design/samples'
import { radii, spacing, touchTarget } from '../../design/tokens'
import { showsTestErrorControls, TestErrorControls } from '../observability/TestErrorControls'
import { observabilityConfig } from '../observability/sentry'
import { clearSavedService } from '../offline/savedServiceStore'
import { MAX_LANGUAGES, usePreferences } from '../preferences/PreferencesProvider'
import { availableInterfaceLanguages, includesDraftLanguages, INTERFACE_CATALOGS, useI18n } from '../i18n'

/** Reading choices only; the operator account lives on the About tab. */
export function Settings() {
  const { preferences, setAppearance, setReadingSize, setSelectedLanguages, setInterfaceLanguage, clear } = usePreferences()
  const { fontScale } = useWindowDimensions()
  const { t } = useI18n()
  const interfaceLanguages = availableInterfaceLanguages(includesDraftLanguages())
  const [forgetting, setForgetting] = useState(false)
  const [forgettingSavedCopy, setForgettingSavedCopy] = useState(false)
  const [lastLanguage, setLastLanguage] = useState(false)
  const page = fontScale > 2 ? spacing.md : spacing.page
  const toggle = (language: Language) => {
    const selected = preferences.selectedLanguages
    if (selected.includes(language) && selected.length === 1) { setLastLanguage(true); return }
    setLastLanguage(false)
    setSelectedLanguages(selected.includes(language) ? selected.filter(value => value !== language) : [...selected, language])
  }
  return <ScrollView testID="settings" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.xl }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <ScreenHeader title={t('common.settings')} />

      <Section title={t('settings.reading')}>
        <AppText variant="label">{t('readingPreferences.appearance')}</AppText>
        <SegmentedControl label={t('readingPreferences.appearance')} value={preferences.appearance} onChange={setAppearance}
          options={[{ value: 'system', label: t('readingPreferences.system') }, { value: 'light', label: t('readingPreferences.light') }, { value: 'dark', label: t('readingPreferences.dark') }]} />
        <AppText variant="caption" tone="muted">{t('readingPreferences.systemHint')}</AppText>
        <AppText variant="label" style={{ marginTop: spacing.sm }}>{t('readingPreferences.readingSize')}</AppText>
        <SegmentedControl label={t('readingPreferences.readingSize')} value={preferences.readingSize} onChange={setReadingSize}
          options={[{ value: 'standard', label: t('readingPreferences.standard') }, { value: 'larger', label: t('readingPreferences.larger') }, { value: 'extraLarge', label: t('readingPreferences.extraLarge') }]} />
        <AppText variant="caption" tone="muted">{t('readingPreferences.readingSizeHint')}</AppText>
      </Section>

      <Section title={t('settings.readingLanguages')}>
        <AppText variant="caption" tone="muted">{t('settings.chooseUpTo', { count: MAX_LANGUAGES })}</AppText>
        {lastLanguage && <StatusPill tone="danger" label={t('common.keepOneReadingLanguage')} />}
        {sampleLanguages.map(item => <LanguageSelectionRow key={item.value} language={item.value} label={item.label} multiple
          disabled={!preferences.selectedLanguages.includes(item.value) && preferences.selectedLanguages.length >= MAX_LANGUAGES}
          selected={preferences.selectedLanguages.includes(item.value)} onPress={() => toggle(item.value)} />)}
      </Section>

      {/* Hidden until a second language ships, so a build with only English has nothing to choose. */}
      {interfaceLanguages.length > 1 && <Section title={t('settings.interfaceLanguage')}>
        <AppText variant="caption" tone="muted">{t('settings.interfaceHint')}</AppText>
        <ChoiceRow label={t('settings.interfaceSystem')} selected={!preferences.interfaceLanguage} onPress={() => setInterfaceLanguage('system')} />
        {interfaceLanguages.map(language => <ChoiceRow key={language} lang={language} selected={preferences.interfaceLanguage === language}
          label={INTERFACE_CATALOGS[language].reviewed ? INTERFACE_CATALOGS[language].nativeName : t('settings.draftLanguage', { language: INTERFACE_CATALOGS[language].nativeName })}
          onPress={() => setInterfaceLanguage(language)} />)}
        {interfaceLanguages.some(language => !INTERFACE_CATALOGS[language].reviewed) && <AppText variant="caption" tone="muted">{t('settings.draftNote')}</AppText>}
      </Section>}

      <Section title={t('settings.readingChoices')}>
        {forgetting ? <>
          <AppText accessibilityRole="alert">{t('readingPreferences.resetConfirm')}</AppText>
          <AppButton variant="destructive" size="card" onPress={() => { clear(); setForgetting(false); setLastLanguage(false) }}>{t('readingPreferences.reset')}</AppButton>
          <AppButton variant="quiet" onPress={() => setForgetting(false)}>{t('readingPreferences.keep')}</AppButton>
        </> : <AppButton variant="secondary" size="card" onPress={() => setForgetting(true)}>{t('readingPreferences.forget')}</AppButton>}
      </Section>

      <Section title={t('settings.savedCopy')}>
        {forgettingSavedCopy ? <>
          <AppText accessibilityRole="alert">{t('settings.removeSavedConfirm')}</AppText>
          <AppButton variant="destructive" size="card" onPress={() => { void clearSavedService(); setForgettingSavedCopy(false) }}>{t('settings.removeSaved')}</AppButton>
          <AppButton variant="quiet" onPress={() => setForgettingSavedCopy(false)}>{t('settings.keepSaved')}</AppButton>
        </> : <>
          <AppText variant="caption" tone="muted">{t('settings.savedNote')}</AppText>
          <AppButton variant="secondary" size="card" onPress={() => setForgettingSavedCopy(true)}>{t('settings.removeSavedButton')}</AppButton>
        </>}
      </Section>

      <LibraryManagement />
      <Help />

      {showsTestErrorControls(observabilityConfig(), __DEV__) && <Section title={t('settings.errorReporting')}>
        <TestErrorControls />
      </Section>}
    </View>
  </ScrollView>
}

/** A single-choice row for the interface language; each language's name is tagged so VoiceOver reads it in that language. */
function ChoiceRow({ label, lang, selected, onPress }: { label: string; lang?: string; selected: boolean; onPress(): void }) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, selected }} accessibilityLanguage={lang} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm,
      borderRadius: radii.control, backgroundColor: pressed ? colors.pressedSubtle : 'transparent' }}>
    <AppText style={{ flex: 1 }}>{label}</AppText>
    {selected && <AppIcon name="selected" color={colors.primary} />}
  </Pressable>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme()
  return <View style={{ marginTop: 26, gap: 10 }}>
    <AppText variant="label" tone="muted" accessibilityRole="header">{title}</AppText>
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.raised }}>
      {children}
    </View>
  </View>
}
