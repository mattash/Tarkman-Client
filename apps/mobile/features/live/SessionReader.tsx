import { useRef, useState } from 'react'
import { Platform, Pressable, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StatusPill } from '../../components/StatusPill'
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

const abbreviations = { en: 'EN', ru: 'RU', grabar: 'Գրբ', translit: 'TR' } as const
export function SessionReader({ endpoints, id, back }: { endpoints: Endpoints; id: number; back(): void }) {
  const { state, retry, dispatch } = useReader(endpoints, id)
  const { preferences, setLanguage, setSelectedLanguages, setAppearance, setReadingSize, clear: clearPreferences } = usePreferences()
  const { colors } = useTheme()
  const { width, height, fontScale } = useWindowDimensions()
  const language = preferences.language
  const [sheet, setSheet] = useState<'language' | 'preferences' | 'explanation' | null>(null)
  const [forgetting, setForgetting] = useState(false)
  const [languageMode, setLanguageMode] = useState<'quick' | 'choose'>('quick')
  const [draftLanguages, setDraftLanguages] = useState<Language[]>(preferences.selectedLanguages)
  const [languageError, setLanguageError] = useState(false)
  const languageOpener = useRef<View>(null), preferencesOpener = useRef<View>(null), explanationOpener = useRef<View>(null)
  const activeOpener = useRef<View>(null)
  const [manualPart, setManualPart] = useState<string | undefined>(undefined)
  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const title = state.session?.title ?? `Session ${id}`
  const accessibilitySize = fontScale > 1.5
  const compactReading = accessibilitySize || width > height || !state.following
  const dismissSheet = () => {
    setDraftLanguages(preferences.selectedLanguages)
    setLanguageError(false)
    setLanguageMode('quick')
    setForgetting(false)
    setSheet(null)
  }
  const openLanguage = () => {
    setDraftLanguages(preferences.selectedLanguages)
    setLanguageError(false)
    setLanguageMode('quick')
    setSheet('language')
  }
  const applyLanguages = () => {
    if (draftLanguages.length === 0) { setLanguageError(true); return }
    setSelectedLanguages(draftLanguages)
    dismissSheet()
  }
  const live = state.listed && state.connected && !state.stale && !state.error && state.session?.status === 'active'
  const details = <View testID="reader-header-details" style={{ paddingHorizontal: spacing.page, paddingBottom: spacing.md, gap: spacing.sm }}>
    <AppText variant="heading">{title}</AppText>
    {state.session?.church && <AppText variant="caption" tone="muted">{state.session.church}</AppText>}
    <ReaderStatus state={state} retry={retry} showLive={false} />
    {state.session && !part && !state.loading && <AppText variant="caption">The current part is not available. You can browse the readings.</AppText>}
  </View>
  return <View style={{ flex: 1 }}>
    <View testID="reader-header-actions" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background, flexShrink: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
        <AppButton variant="quiet" icon="back" iconOnly={width < 600 || accessibilitySize} onPress={back}>All services</AppButton>
        {live && <StatusPill label="Live" tone="success" icon="connected" />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, marginLeft: 'auto', flexShrink: 1 }}>
        <AppButton testID="reader-language" ref={languageOpener} variant="quiet" selected icon="languages"
          onPress={() => { activeOpener.current = languageOpener.current; openLanguage() }}
          accessibilityLabel="Choose reading language" accessibilityHint={`Current language: ${sampleLanguages.find(l => l.value === language)!.label}`}>
          {abbreviations[language]}
        </AppButton>
        <AppButton testID="reader-explain" ref={explanationOpener} variant="quiet" icon="explanation" iconOnly disabled={!part}
          onPress={() => { activeOpener.current = explanationOpener.current; setSheet('explanation') }}>Explain current part</AppButton>
        <AppButton testID="reader-preferences" ref={preferencesOpener} variant="quiet" icon="preferences" iconOnly
          onPress={() => { activeOpener.current = preferencesOpener.current; setSheet('preferences') }}>Reading preferences</AppButton>
      </View>
    </View>
    {state.loading ? details : <PartList parts={state.parts} currentKey={part?.key} following={state.following} language={language}
      selectedLanguages={preferences.selectedLanguages} readingSize={preferences.readingSize} paused={state.session?.status === 'paused'}
      header={details} compact={compactReading} switchLanguage={setLanguage}
      manual={() => { if (state.following) setManualPart(part?.key); dispatch({ type: 'manual' }) }}
      open={item => router.push(`/sessions/${id}/part/${item.id}`)} />}
    {!state.following && <View testID="return-to-live" style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md,
      paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.background }}>
      {!accessibilitySize && <AppText variant="caption" tone="muted">{manualPart !== undefined && manualPart !== part?.key ? 'Live reading moved on' : 'Reading at your own pace'}</AppText>}
      <AppButton icon="live" rounded accessibilityHint="Resumes automatically following the current part."
        onPress={() => { dispatch({ type: 'follow' }); retry() }}>Return to live</AppButton>
    </View>}
    <AppModal visible={sheet !== null} title={sheet === 'language' ? (languageMode === 'quick' ? 'Reading language' : 'Choose languages')
      : sheet === 'preferences' ? 'Reading preferences' : 'Explanation'}
      openerRef={activeOpener} onDismiss={dismissSheet} dismissLabel={sheet === 'language' && languageMode === 'choose' ? 'Cancel' : 'Done'}
      headerAction={sheet === 'language' && languageMode === 'choose' ? <AppButton variant="quiet" onPress={applyLanguages}>Apply languages</AppButton> : undefined}>
      {sheet === 'language' ? languageMode === 'quick' ? <>
        <AppText variant="caption" tone="muted">Switching keeps your place and live-following state.</AppText>
        {preferences.selectedLanguages.map(value => {
          const item = sampleLanguages.find(candidate => candidate.value === value)!
          return <LanguageSelectionRow key={value} language={value} label={item.label} selected={value === language}
            onPress={() => { setLanguage(value); dismissSheet() }} />
        })}
        <AppButton variant="quiet" icon="next" onPress={() => {
          setDraftLanguages(preferences.selectedLanguages)
          setLanguageError(false)
          setLanguageMode('choose')
        }}>Choose languages</AppButton>
      </> : <>
        <AppText variant="caption" tone="muted">Choose the languages available in the quick switcher.</AppText>
        {languageError && <StatusPill tone="danger" label="Keep at least one reading language." />}
        {sampleLanguages.map(item => <LanguageSelectionRow key={item.value} language={item.value} label={item.label} multiple
          selected={draftLanguages.includes(item.value)} onPress={() => {
            setLanguageError(false)
            setDraftLanguages(current => current.includes(item.value) ? current.filter(value => value !== item.value) : [...current, item.value])
          }} />)}
      </> : sheet === 'preferences' ? <>
        <AppText variant="label">Appearance</AppText>
        <SegmentedControl label="Appearance" value={preferences.appearance} onChange={setAppearance}
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <AppText variant="caption" tone="muted">System follows this device’s light or dark appearance.</AppText>
        <AppText variant="label" style={{ marginTop: spacing.md }}>Reading size</AppText>
        <SegmentedControl label="Reading size" value={preferences.readingSize} onChange={setReadingSize}
          options={[{ value: 'standard', label: 'Standard' }, { value: 'larger', label: 'Larger' }, { value: 'extraLarge', label: 'Extra large' }]} />
        <View style={{ backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, borderRadius: radii.control }}>
          <AppText variant="caption" tone="muted">Preview · current part</AppText>
          <LiturgyText text={part?.text[language]?.split(/\r?\n/)[0]} language={language} readingSize={preferences.readingSize} compactStanzas />
        </View>
        <AppText variant="caption" tone="muted">Reading size adds to your device’s text size setting.</AppText>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.lg, marginTop: spacing.md, gap: spacing.sm }}>
          {forgetting ? <>
            <AppText accessibilityRole="alert">Reset your reading languages and reading size? Appearance will stay the same.</AppText>
            <AppButton variant="destructive" onPress={() => { clearPreferences(); dismissSheet() }}>Reset reading choices</AppButton>
            <AppButton variant="quiet" onPress={() => setForgetting(false)}>Keep my choices</AppButton>
          </> : <AppButton variant="secondary" onPress={() => setForgetting(true)}>Forget my reading choices</AppButton>}
        </View>
      </> : <>
        <AppText variant="label" style={{ textTransform: 'capitalize' }}>{part?.role ?? 'Current part unavailable'}</AppText>
        <AppText variant="caption" tone="muted">Explanations follow the service’s current part, even while you read elsewhere.</AppText>
        {state.loading ? <StatusPill label="Loading the explanation…" tone="info" busy />
          : state.stale ? <StatusPill label="Reconnecting" tone="info" message="Explanations will refresh with the current part." />
          : state.explanationError ? <><StatusPill label="Could not load explanations." tone="danger" /><AppButton loading={state.refreshing} onPress={retry}>Retry explanations</AppButton></>
          : state.explanations.length === 0 ? <AppText variant="explanation">No explanation is available for this part.</AppText>
          : state.explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}>
            <AppText variant="heading">{explanation.title}</AppText><LiturgyText variant="explanation" text={explanation.description} />
          </View>)}
      </>}
    </AppModal>
  </View>
}

function LanguageSelectionRow({ label, language, selected, multiple = false, onPress }: {
  label: string; language: Language; selected: boolean; multiple?: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'button'} accessibilityLabel={label}
    accessibilityHint={multiple ? selected ? 'Double tap to remove this language' : 'Double tap to add this language' : undefined}
    {...(Platform.OS === 'web' ? multiple ? { 'aria-checked': selected } : { 'aria-selected': selected } : {})}
    accessibilityState={multiple ? { checked: selected, selected } : { selected }} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.control,
      borderBottomWidth: 1, borderBottomColor: colors.divider,
      backgroundColor: pressed ? colors.pressed : selected ? colors.secondary : colors.overlay }}>
    <AppText language={language} style={{ flex: 1, color: pressed ? colors.onPrimary : selected ? colors.onSecondary : colors.foreground }}>{label}</AppText>
    {(selected || multiple) && <AppIcon name={multiple ? selected ? 'checkbox' : 'unchecked' : 'selected'} color={pressed ? colors.onPrimary : selected ? colors.onSecondary : colors.muted} />}
  </Pressable>
}
