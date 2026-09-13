import { useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { usePreferences } from '../preferences/PreferencesProvider'
import { LiturgyText } from '../../components/LiturgyText'
import { radii, spacing, touchTarget } from '../../design/tokens'
import { useTheme } from '../../design/ThemeProvider'
import { sampleLanguages } from '../../design/samples'
import type { Endpoints } from './config'
import { currentPart } from './contracts'
import { useReader } from './useReader'
import { PartList } from './PartList'
import { ReaderStatus } from './ReaderStatus'
export function SessionReader({ endpoints, id, back }: { endpoints: Endpoints; id: number; back(): void }) {
  const { state, retry, dispatch } = useReader(endpoints, id)
  const { preferences, setLanguage, setSelectedLanguages, setAppearance, clear: clearPreferences } = usePreferences()
  const language = preferences.language
  const [sheet, setSheet] = useState<'language' | 'preferences' | 'explanation' | null>(null)
  const [languageMode, setLanguageMode] = useState<'quick' | 'choose'>('quick')
  const [draftLanguages, setDraftLanguages] = useState<Language[]>(preferences.selectedLanguages)
  const [languageError, setLanguageError] = useState(false)
  const languageOpener = useRef<View>(null), preferencesOpener = useRef<View>(null), explanationOpener = useRef<View>(null), activeOpener = useRef<View>(null)
  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const dismissSheet = () => {
    setDraftLanguages(preferences.selectedLanguages)
    setLanguageError(false)
    setLanguageMode('quick')
    setSheet(null)
  }
  return <View style={{ flex: 1 }}>
    <View testID="reader-header-actions" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: spacing.md, maxWidth: 800, width: '100%', alignSelf: 'center', flexShrink: 0 }}>
      <View style={{ flexShrink: 1 }}>
        <AppButton variant="quiet" onPress={back}>All services</AppButton>
      </View>
      {!state.following && <View style={{ flexShrink: 1, marginLeft: 'auto' }}>
        <AppButton accessibilityHint="Resumes automatically following the current part." onPress={() => { dispatch({ type: 'follow' }); retry() }}>Return to live</AppButton>
      </View>}
    </View>
    <ScrollView testID="reader-header-details" style={{ flexGrow: 0, maxHeight: '50%' }} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
      <AppText variant="heading">{state.session?.title ?? `Session ${id}`}</AppText>
      <ReaderStatus state={state} retry={retry} />
      {state.session && state.session.status !== 'active' && <AppText accessibilityLiveRegion="polite">{state.session.status === 'paused' ? 'Service paused' : `Service status: ${state.session.status.replaceAll('_', ' ')}`}{state.session.message ? ` · ${state.session.message}` : ''}</AppText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppButton testID="reader-language" ref={languageOpener} variant="secondary" onPress={() => {
          activeOpener.current = languageOpener.current
          setDraftLanguages(preferences.selectedLanguages)
          setLanguageError(false)
          setLanguageMode('quick')
          setSheet('language')
        }} accessibilityLabel="Choose reading language">{sampleLanguages.find(l => l.value === language)!.label}</AppButton>
        <AppButton testID="reader-preferences" ref={preferencesOpener} variant="secondary"
          onPress={() => { activeOpener.current = preferencesOpener.current; setSheet('preferences') }}>Reading preferences</AppButton>
        <AppButton testID="reader-explain" ref={explanationOpener} variant="secondary" disabled={!part} onPress={() => { activeOpener.current = explanationOpener.current; setSheet('explanation') }}>Explain current part</AppButton>
      </View>
      {state.session && !part && !state.loading && <AppText variant="caption">The current part is not available. You can browse the readings.</AppText>}
    </ScrollView>
    {!state.loading && <PartList parts={state.parts} currentKey={part?.key} following={state.following} language={language}
      selectedLanguages={preferences.selectedLanguages} manual={() => dispatch({ type: 'manual' })} open={item => router.push(`/sessions/${id}/part/${item.id}`)} />}
    <AppModal visible={sheet !== null} title={sheet === 'language' ? (languageMode === 'quick' ? 'Reading language' : 'Choose languages') : sheet === 'preferences' ? 'Reading preferences' : 'Current part explanation'} openerRef={activeOpener} onDismiss={dismissSheet}>
      {sheet === 'language' ? languageMode === 'quick' ? <>
        <AppText variant="caption" tone="muted">Switching keeps your place and live-following state.</AppText>
        {preferences.selectedLanguages.map(value => {
          const item = sampleLanguages.find(candidate => candidate.value === value)!
          return <AppButton key={'active-' + value} variant={value === language ? 'primary' : 'secondary'}
            accessibilityState={{ selected: value === language }} onPress={() => { setLanguage(value); setSheet(null) }}>{item.label}</AppButton>
        })}
        <AppButton variant="quiet" onPress={() => {
          setDraftLanguages(preferences.selectedLanguages)
          setLanguageError(false)
          setLanguageMode('choose')
        }}>Choose languages</AppButton>
      </> : <>
        <AppText variant="caption" tone="muted">Choose the languages available in the quick switcher.</AppText>
        {sampleLanguages.map(item => <LanguageSelectionRow key={item.value} label={item.label}
          selected={draftLanguages.includes(item.value)} onPress={() => {
            setLanguageError(false)
            setDraftLanguages(current => current.includes(item.value) ? current.filter(value => value !== item.value) : [...current, item.value])
          }} />)}
        {languageError && <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive">Keep at least one reading language.</AppText>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <AppButton variant="secondary" onPress={() => {
            setDraftLanguages(preferences.selectedLanguages)
            setLanguageError(false)
            setLanguageMode('quick')
          }}>Cancel</AppButton>
          <AppButton onPress={() => {
            if (draftLanguages.length === 0) { setLanguageError(true); return }
            setSelectedLanguages(draftLanguages)
            setSheet(null)
          }}>Apply languages</AppButton>
        </View>
      </> : sheet === 'preferences' ? <>
        <AppText variant="label">Appearance</AppText>
        {(['system', 'light', 'dark'] as const).map(appearance => <AppButton key={appearance}
          variant={preferences.appearance === appearance ? 'primary' : 'secondary'}
          accessibilityState={{ selected: preferences.appearance === appearance }}
          onPress={() => setAppearance(appearance)}>{appearance === 'system' ? 'System' : appearance === 'light' ? 'Light' : 'Dark'}</AppButton>)}
        <AppText variant="caption" tone="muted">System follows this device’s light or dark appearance.</AppText>
        <AppButton variant="quiet" onPress={() => { clearPreferences(); setSheet(null) }}>Forget my reading choices</AppButton>
      </> : <>
        <AppText variant="caption" tone="muted">Explanations follow the service’s current part, even while you read elsewhere.</AppText>
        <AppText variant="label">{part ? `${part.position} / ${part.role}` : 'Current part unavailable'}</AppText>
        {state.stale ? <AppText>Reconnecting. Explanations will refresh with the current part.</AppText> : state.explanationError ? <><AppText accessibilityRole="alert">Could not load explanations.</AppText><AppButton loading={state.refreshing} onPress={retry}>Retry explanations</AppButton></> : state.explanations.length === 0 ? <AppText>No explanation is available for this part.</AppText> : state.explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}><AppText variant="heading">{explanation.title}</AppText><LiturgyText text={explanation.description} /></View>)}
      </>}
    </AppModal>
  </View>
}

function LanguageSelectionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const { colors } = useTheme()
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
    accessibilityHint={selected ? 'Double tap to remove this language' : 'Double tap to add this language'}
    accessibilityState={{ checked: selected, selected }} onPress={onPress}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control,
      borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
      backgroundColor: selected ? colors.secondary : colors.surface }}>
    <View accessible={false} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2,
      borderColor: selected ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
      {selected && <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.primary }} />}
    </View>
    <AppText style={{ flex: 1 }} tone={selected ? 'accent' : 'default'}>{label}</AppText>
  </Pressable>
}
