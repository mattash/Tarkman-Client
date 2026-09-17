import { useEffect, useRef, useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { SegmentedControl } from '../../components/SegmentedControl'
import { StatusPill } from '../../components/StatusPill'
import { MAX_LANGUAGES, usePreferences } from '../preferences/PreferencesProvider'
import { LiturgyText } from '../../components/LiturgyText'
import { LanguageSelectionRow } from '../../components/LanguageSelectionRow'
import { radii, spacing } from '../../design/tokens'
import { useTheme } from '../../design/ThemeProvider'
import { sampleLanguages } from '../../design/samples'
import type { Endpoints } from './config'
import { currentPart } from './contracts'
import { useReader } from './useReader'
import { publishLivePosition } from './livePosition'
import { saveLastReading } from '../progress/lastReading'
import { PartList } from './PartList'
import { ReaderStatus } from './ReaderStatus'
import { useScreenKeepAwake } from '../keepAwake/useScreenKeepAwake'
import { useI18n } from '../i18n'

const abbreviations = { en: 'EN', ru: 'RU', grabar: 'Գրբ', translit: 'TR' } as const
export function SessionReader({ endpoints, id, back }: { endpoints: Endpoints; id: number; back(): void }) {
  useScreenKeepAwake('tarkman-live-reader')
  const { state, retry, dispatch, saved } = useReader(endpoints, id)
  const { preferences, setLanguage, setSelectedLanguages, setAppearance, setReadingSize, clear: clearPreferences } = usePreferences()
  const { colors } = useTheme()
  const { t } = useI18n()
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
  // Storage is a render fallback only; live state and its position channel stay authoritative.
  const showingSaved = !state.loading && !!state.error && state.parts.length === 0 && saved != null && saved.session.id === id
  const following = !showingSaved && state.following
  const savedExplanations = showingSaved ? saved.explanations?.items ?? [] : []
  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const title = state.session?.title ?? (showingSaved ? saved.session.title : t('reader.sessionFallbackTitle', { id }))
  const church = state.session?.church ?? (showingSaved ? saved.session.church : undefined)
  // Continue reading on Today: the service and the part it had reached, kept on this device only.
  const session = state.session, role = part?.role ?? null
  useEffect(() => {
    if (session) void saveLastReading({ sessionId: id, title: session.title, church: session.church, date: session.date, role })
  }, [id, session, role])
  // Part detail reads the live position from here rather than opening its own connection.
  const parts = state.parts, currentKey = part?.key
  useEffect(() => publishLivePosition({ sessionId: id, parts, currentKey, follow: () => { dispatch({ type: 'follow' }); retry() } }),
    [id, parts, currentKey, dispatch, retry])
  const accessibilitySize = fontScale > 1.5
  const compactReading = accessibilitySize || width > height || !following
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
  const live = !showingSaved && state.listed && state.connected && !state.stale && !state.error && state.session?.status === 'active'
  const details = <View testID="reader-header-details" style={{ paddingHorizontal: spacing.page, paddingBottom: spacing.md, gap: spacing.sm }}>
    <AppText variant="heading">{title}</AppText>
    {church && <AppText variant="caption" tone="muted">{church}</AppText>}
    <ReaderStatus state={state} retry={retry} showLive={false} savedCopy={showingSaved} />
    {!showingSaved && state.session && !part && !state.loading && <AppText variant="caption">{t('reader.currentPartUnavailable')}</AppText>}
  </View>
  return <View style={{ flex: 1 }}>
    <View testID="reader-header-actions" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background, flexShrink: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
        <AppButton variant="quiet" icon="back" iconOnly={width < 600 || accessibilitySize} onPress={back}>{t('common.allServices')}</AppButton>
        {live && <StatusPill label={t('common.live')} tone="success" icon="connected" announce={false} />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, marginLeft: 'auto', flexShrink: 1 }}>
        <AppButton testID="reader-language" ref={languageOpener} variant="quiet" selected icon="languages"
          onPress={() => { activeOpener.current = languageOpener.current; openLanguage() }}
          accessibilityLabel={t('reader.chooseReadingLanguage')} accessibilityHint={t('reader.currentLanguageHint', { language: sampleLanguages.find(l => l.value === language)!.label })}>
          {abbreviations[language]}
        </AppButton>
        <AppButton testID="reader-explain" ref={explanationOpener} variant="quiet" icon="explanation" iconOnly disabled={!showingSaved && !part}
          onPress={() => { activeOpener.current = explanationOpener.current; setSheet('explanation') }}>{showingSaved ? t('reader.explainSavedText') : t('reader.explainCurrentPart')}</AppButton>
        <AppButton testID="reader-preferences" ref={preferencesOpener} variant="quiet" icon="preferences" iconOnly
          onPress={() => { activeOpener.current = preferencesOpener.current; setSheet('preferences') }}>{t('readingPreferences.title')}</AppButton>
      </View>
    </View>
    {state.loading ? details : <PartList parts={showingSaved ? saved.parts : state.parts} currentKey={showingSaved ? undefined : part?.key} following={following} language={language}
      selectedLanguages={preferences.selectedLanguages} readingSize={preferences.readingSize} paused={!showingSaved && state.session?.status === 'paused'}
      header={details} compact={compactReading} switchLanguage={setLanguage}
      manual={() => { if (showingSaved) return; if (state.following) setManualPart(part?.key); dispatch({ type: 'manual' }) }}
      // Role and posture travel with the route so part detail can draw its header before the part loads.
      open={item => router.push({ pathname: '/sessions/[id]/part/[partId]', params: { id: String(id), partId: String(item.id), key: item.key,
        role: item.role, service: title, ...(item.posture ? { posture: item.posture } : {}) } })} />}
    {!following && <View testID="return-to-live" style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md,
      paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.background }}>
      {!accessibilitySize && <AppText variant="caption" tone="muted">{showingSaved ? t('reader.showingSavedText') : manualPart !== undefined && manualPart !== part?.key ? t('reader.liveMovedOn') : t('reader.ownPace')}</AppText>}
      <AppButton icon="live" rounded accessibilityHint={showingSaved ? t('reader.returnToLiveSavedHint') : t('reader.returnToLiveHint')}
        onPress={() => { dispatch({ type: 'follow' }); retry() }}>{t('reader.returnToLive')}</AppButton>
    </View>}
    <AppModal visible={sheet !== null} title={sheet === 'language' ? (languageMode === 'quick' ? t('reader.readingLanguage') : t('reader.chooseLanguages'))
      : sheet === 'preferences' ? t('readingPreferences.title') : t('common.explanation')}
      openerRef={activeOpener} onDismiss={dismissSheet} dismissLabel={sheet === 'language' && languageMode === 'choose' ? t('common.cancel') : t('common.done')}
      headerAction={sheet === 'language' && languageMode === 'choose' ? <AppButton variant="quiet" onPress={applyLanguages}>{t('reader.applyLanguages')}</AppButton> : undefined}>
      {sheet === 'language' ? languageMode === 'quick' ? <>
        <AppText variant="caption" tone="muted">{t('reader.switchingKeepsPlace')}</AppText>
        {preferences.selectedLanguages.map(value => {
          const item = sampleLanguages.find(candidate => candidate.value === value)!
          return <LanguageSelectionRow key={value} language={value} label={item.label} selected={value === language}
            onPress={() => { setLanguage(value); dismissSheet() }} />
        })}
        <AppButton variant="quiet" icon="next" onPress={() => {
          setDraftLanguages(preferences.selectedLanguages)
          setLanguageError(false)
          setLanguageMode('choose')
        }}>{t('reader.chooseLanguages')}</AppButton>
      </> : <>
        <AppText variant="caption" tone="muted">{t('reader.chooseUpTo', { count: MAX_LANGUAGES })}</AppText>
        {languageError && <StatusPill tone="danger" label={t('common.keepOneReadingLanguage')} />}
        {/* Three is the most that fit side by side, so a fourth cannot be added until one is removed. */}
        {sampleLanguages.map(item => <LanguageSelectionRow key={item.value} language={item.value} label={item.label} multiple
          disabled={!draftLanguages.includes(item.value) && draftLanguages.length >= MAX_LANGUAGES}
          selected={draftLanguages.includes(item.value)} onPress={() => {
            setLanguageError(false)
            setDraftLanguages(current => current.includes(item.value) ? current.filter(value => value !== item.value) : [...current, item.value])
          }} />)}
      </> : sheet === 'preferences' ? <>
        <AppText variant="label">{t('readingPreferences.appearance')}</AppText>
        <SegmentedControl label={t('readingPreferences.appearance')} value={preferences.appearance} onChange={setAppearance}
          options={[{ value: 'system', label: t('readingPreferences.system') }, { value: 'light', label: t('readingPreferences.light') }, { value: 'dark', label: t('readingPreferences.dark') }]} />
        <AppText variant="caption" tone="muted">{t('readingPreferences.systemHint')}</AppText>
        <AppText variant="label" style={{ marginTop: spacing.md }}>{t('readingPreferences.readingSize')}</AppText>
        <SegmentedControl label={t('readingPreferences.readingSize')} value={preferences.readingSize} onChange={setReadingSize}
          options={[{ value: 'standard', label: t('readingPreferences.standard') }, { value: 'larger', label: t('readingPreferences.larger') }, { value: 'extraLarge', label: t('readingPreferences.extraLarge') }]} />
        <View style={{ backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, borderRadius: radii.control }}>
          <AppText variant="caption" tone="muted">{showingSaved ? t('reader.previewSaved') : t('reader.previewCurrent')}</AppText>
          <LiturgyText text={(showingSaved ? saved.parts[0] : part)?.text[language]?.split(/\r?\n/)[0]} language={language} readingSize={preferences.readingSize} compactStanzas />
        </View>
        <AppText variant="caption" tone="muted">{t('readingPreferences.readingSizeHint')}</AppText>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.lg, marginTop: spacing.md, gap: spacing.sm }}>
          {forgetting ? <>
            <AppText accessibilityRole="alert">{t('readingPreferences.resetConfirm')}</AppText>
            <AppButton variant="destructive" onPress={() => { clearPreferences(); dismissSheet() }}>{t('readingPreferences.reset')}</AppButton>
            <AppButton variant="quiet" onPress={() => setForgetting(false)}>{t('readingPreferences.keep')}</AppButton>
          </> : <AppButton variant="secondary" onPress={() => setForgetting(true)}>{t('readingPreferences.forget')}</AppButton>}
        </View>
      </> : <>
        <AppText variant="label" style={{ textTransform: 'capitalize' }}>{showingSaved ? t('reader.lastSeenExplanations') : part?.role ?? t('reader.currentPartUnavailableShort')}</AppText>
        <AppText variant="caption" tone="muted">{showingSaved ? t('reader.savedExplanationsNote') : t('reader.explanationsFollowNote')}</AppText>
        {showingSaved ? savedExplanations.length === 0 ? <AppText variant="explanation">{t('reader.noSavedExplanation')}</AppText>
          : savedExplanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}>
            <AppText variant="heading">{explanation.title}</AppText><LiturgyText variant="explanation" text={explanation.description} blocks />
          </View>)
          : state.loading ? <StatusPill label={t('reader.loadingExplanation')} tone="info" busy />
          : state.stale ? <StatusPill label={t('common.reconnecting')} tone="info" message={t('reader.explanationsRefresh')} />
          : state.explanationError ? <><StatusPill label={t('reader.couldNotLoadExplanations')} tone="danger" /><AppButton loading={state.refreshing} onPress={retry}>{t('reader.retryExplanations')}</AppButton></>
          : state.explanations.length === 0 ? <AppText variant="explanation">{t('common.noPartExplanation')}</AppText>
          : state.explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}>
            <AppText variant="heading">{explanation.title}</AppText><LiturgyText variant="explanation" text={explanation.description} blocks />
          </View>)}
      </>}
    </AppModal>
  </View>
}
