import { useState, type ReactNode } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { LanguageSelectionRow } from '../../components/LanguageSelectionRow'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ServiceRow } from '../../components/ServiceRow'
import { StatusPill } from '../../components/StatusPill'
import { useTheme } from '../../design/ThemeProvider'
import { sampleLanguages } from '../../design/samples'
import { radii, spacing } from '../../design/tokens'
import { useAuth } from '../auth/AuthProvider'
import { usePreferences } from '../preferences/PreferencesProvider'

/** Reading choices first; the operator account sits last, the only place sign-in appears. */
export function Settings() {
  const { preferences, setAppearance, setReadingSize, setSelectedLanguages, clear } = usePreferences()
  const { state, signOut } = useAuth()
  const { fontScale } = useWindowDimensions()
  const [forgetting, setForgetting] = useState(false)
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
      <ScreenHeader title="Settings" />

      <Section title="Reading">
        <AppText variant="label">Appearance</AppText>
        <SegmentedControl label="Appearance" value={preferences.appearance} onChange={setAppearance}
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <AppText variant="caption" tone="muted">System follows this device’s light or dark appearance.</AppText>
        <AppText variant="label" style={{ marginTop: spacing.sm }}>Reading size</AppText>
        <SegmentedControl label="Reading size" value={preferences.readingSize} onChange={setReadingSize}
          options={[{ value: 'standard', label: 'Standard' }, { value: 'larger', label: 'Larger' }, { value: 'extraLarge', label: 'Extra large' }]} />
        <AppText variant="caption" tone="muted">Reading size adds to your device’s text size setting.</AppText>
      </Section>

      <Section title="Reading languages">
        <AppText variant="caption" tone="muted">Choose the languages available in the reader’s quick switcher.</AppText>
        {lastLanguage && <StatusPill tone="danger" label="Keep at least one reading language." />}
        {sampleLanguages.map(item => <LanguageSelectionRow key={item.value} language={item.value} label={item.label} multiple
          selected={preferences.selectedLanguages.includes(item.value)} onPress={() => toggle(item.value)} />)}
      </Section>

      <Section title="Reading choices">
        {forgetting ? <>
          <AppText accessibilityRole="alert">Reset your reading languages and reading size? Appearance will stay the same.</AppText>
          <AppButton variant="destructive" size="card" onPress={() => { clear(); setForgetting(false); setLastLanguage(false) }}>Reset reading choices</AppButton>
          <AppButton variant="quiet" onPress={() => setForgetting(false)}>Keep my choices</AppButton>
        </> : <AppButton variant="secondary" size="card" onPress={() => setForgetting(true)}>Forget my reading choices</AppButton>}
      </Section>

      {state.status !== 'hydrating' && <Section title="Account" plain>
        {state.status === 'signedIn' ? <>
          <AppText variant="caption" tone="muted">Signed in as {state.user.name || state.user.email}</AppText>
          <ServiceRow title="My services" subtitle="Run the services you manage" onPress={() => router.push('/services')} />
          <View style={{ alignSelf: 'flex-start' }}><AppButton variant="secondary" size="card" onPress={signOut}>Sign out</AppButton></View>
        </> : <ServiceRow title="Sign in" subtitle="For clergy and parish staff who run services" onPress={() => router.push('/sign-in')} />}
      </Section>}
    </View>
  </ScrollView>
}

function Section({ title, plain = false, children }: { title: string; plain?: boolean; children: ReactNode }) {
  const { colors } = useTheme()
  return <View style={{ marginTop: 26, gap: 10 }}>
    <AppText variant="label" tone="muted" accessibilityRole="header">{title}</AppText>
    <View style={plain ? { gap: 10 } : { gap: spacing.sm, padding: spacing.md, borderRadius: radii.card, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.raised }}>
      {children}
    </View>
  </View>
}
