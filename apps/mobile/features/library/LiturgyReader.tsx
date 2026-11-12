import { useCallback, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { BackButton } from '../../components/BackButton'
import { LanguageSelectionRow } from '../../components/LanguageSelectionRow'
import { LiturgyText } from '../../components/LiturgyText'
import { PartHeading } from '../../components/PartHeading'
import { SegmentedControl } from '../../components/SegmentedControl'
import { spacing } from '../../design/tokens'
import { useTheme } from '../../design/ThemeProvider'
import { sampleLanguages } from '../../design/samples'
import { PartList } from '../live/PartList'
import { languageAbbreviations } from '../live/languageAbbreviations'
import type { LivePart } from '../live/contracts'
import { usePreferences } from '../preferences/PreferencesProvider'
import { useI18n } from '../i18n'
import { useLibrary } from './LibraryProvider'
import { readLibraryId } from '../links/libraryLink'
import { useShareService } from './useShareService'
import { ShareNotice, ShareManualModal } from './ShareService'
import type { Bundle, Occurrence } from './contracts'

/** Pins one complete immutable revision. No SessionReader/controller/presence dependency. */
export function LiturgyReader() {
  const params = useLocalSearchParams<{ id: string; environment?: string | string[]; origin?: string }>()
  const { controller } = useLibrary()
  // A link names a service, never a server. Only an absent environment uses this build.
  const environment = params.environment === undefined ? controller.environment : params.environment
  return <Reader key={`${environment}:${params.id}:${controller.environment}`} id={readLibraryId(params.id)} environment={environment} origin={params.origin} />
}
function Reader({ id, environment, origin }: { id: number; environment: string | string[]; origin?: string }) {
  const { controller, state } = useLibrary(), { t } = useI18n()
  const { preferences, setLanguage, setReadingSize, setAppearance } = usePreferences()
  const { colors } = useTheme()
  const { anchor: shareAnchor, busy, notice, manual, dismiss, share } = useShareService(), compact = useWindowDimensions().width < 360
  const [sheet, setSheet] = useState<'language' | 'preferences' | null>(null)
  const languageOpener = useRef<View>(null), preferencesOpener = useRef<View>(null), explanationOpener = useRef<View>(null)
  // With no live position, the book explains the part at the top of the screen.
  const [topKey, setTopKey] = useState<string | undefined>(undefined)
  // Focus returns to whichever button opened the sheet; `sheet` is already null when the modal restores it.
  const opener = useRef<View>(null)
  const openSheet = (next: 'language' | 'preferences') => { opener.current = (next === 'language' ? languageOpener : preferencesOpener).current; setSheet(next) }
  const sameEnvironment = environment === controller.environment
  const validId = Number.isSafeInteger(id) && id > 0
  const [attempt, setAttempt] = useState(0)
  const stored = state.items.find(i => i.id === id)
  const [snapshot, setSnapshot] = useState<{ bundle: Bundle; savedAt: number | null } | null>(() => stored?.bundle && sameEnvironment ? { bundle: stored.bundle, savedAt: stored.savedAt } : null)
  const [failed, setFailed] = useState(false), [detail, setDetail] = useState<Occurrence | null>(null)
  useFocusEffect(useCallback(() => {
    let active = true
    if (snapshot || !state.ready || !sameEnvironment || !validId || !controller.enabled || controller.getSnapshot().revoked.includes(id)) return
    const saved = controller.getSnapshot().items.find(i => i.id === id)
    if (saved?.bundle) {
      void Promise.resolve().then(() => { if (active) setSnapshot({ bundle: saved.bundle!, savedAt: saved.savedAt }) })
      return () => { active = false }
    }
    const request = new AbortController()
    void controller.request(id, false, request.signal).then(bundle => {
      if (active) { if (bundle) setSnapshot({ bundle, savedAt: null }); else setFailed(true) }
    }, () => { if (active) setFailed(true) })
    return () => { active = false; request.abort() }
    // The explicit retry counter intentionally restarts this focus-scoped request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, id, sameEnvironment, state.ready, attempt, validId, snapshot]))
  const revoked = state.revoked.includes(id)
  if (revoked && snapshot) setSnapshot(null)
  const parts = useMemo<LivePart[]>(() => snapshot?.bundle.parts.map(p => ({
    id: p.part_id, key: `library:${p.liturgy_part_id}`, liturgyId: p.liturgy_id, liturgyPartId: p.liturgy_part_id,
    position: p.position, role: p.role, posture: p.posture, page: p.page,
    text: { en: p.requires_session_context && p.text.en === null ? t('library.sessionContext') : p.text.en,
      ru: p.text.ru, grabar: p.text.grabar, translit: p.text.translit },
  })) ?? [], [snapshot, t])
  const occurrence = (part: LivePart | undefined) => part ? snapshot?.bundle.parts.find(p => p.liturgy_part_id === part.liturgyPartId) ?? null : null
  const topPart = occurrence(parts.find(p => p.key === topKey) ?? parts[0])
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/live') }
  const backLabel = t(router.canGoBack() ? origin === 'library' ? 'library.back' : 'onboarding.back' : 'servicesList.title')
  const reading = !!snapshot && sameEnvironment && !revoked
  // The live reader's toolbar: one pinned row, so the text scrolls beneath it instead of below a block of controls.
  const toolbar = <View testID="library-reader-toolbar" style={{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background, flexShrink: 0 }}>
    <BackButton iconOnly onPress={back}>{backLabel}</BackButton>
    {reading && <View style={{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto', flexShrink: 0 }}>
      {controller.enabled && validId && <AppButton testID="library-reader-share" ref={shareAnchor} variant="quiet" icon="share" iconOnly disabled={busy}
        accessibilityLabel={t('library.shareTitle', { name: snapshot.bundle.liturgy.name })}
        onPress={() => share(id, snapshot.bundle.liturgy.name)}>{t('library.share')}</AppButton>}
      <AppButton testID="library-reader-language" ref={languageOpener} variant="quiet" selected icon={compact ? undefined : 'languages'} labelMaxFontSizeMultiplier={1.3} labelNumberOfLines={1}
        onPress={() => openSheet('language')}
        accessibilityLabel={t('reader.chooseReadingLanguage')} accessibilityHint={t('reader.currentLanguageHint', { language: sampleLanguages.find(l => l.value === preferences.language)!.label })}>
        {languageAbbreviations[preferences.language]}
      </AppButton>
      <AppButton testID="library-reader-explain" ref={explanationOpener} variant="quiet" icon="explanation" iconOnly disabled={!topPart}
        highlighted={!!topPart?.explanations.length} onPress={() => { opener.current = explanationOpener.current; setDetail(topPart) }}>{t('library.details')}</AppButton>
      <AppButton testID="library-reader-preferences" ref={preferencesOpener} variant="quiet" icon="preferences" iconOnly
        onPress={() => openSheet('preferences')}>{t('readingPreferences.title')}</AppButton>
    </View>}
  </View>
  const details = reading ? <View testID="library-reader-details" style={{ paddingHorizontal: spacing.page, paddingBottom: spacing.md, gap: spacing.sm }}>
    <AppText variant="heading">{snapshot.bundle.liturgy.name}</AppText>
    {snapshot.savedAt && stored?.bundle && <AppText variant="caption" tone="muted">{t('library.downloaded')}</AppText>}
    {stored?.bundle && stored.bundle.revision !== snapshot.bundle.revision && <AppText variant="caption" accessibilityLiveRegion="polite">{t('library.reopen')}</AppText>}
  </View> : undefined
  const message = (text: string, alert: boolean) => <View style={{ padding: spacing.page, gap: spacing.md }}>
    <AppText accessibilityRole={alert ? 'alert' : undefined}>{text}</AppText>
  </View>
  if (revoked || !sameEnvironment) return <View>{toolbar}{message(t('library.errors.unavailable'), true)}</View>
  const paused = state.error === 'rate-limited' && ['downloading', 'updating'].includes(state.status[id])
  if (!snapshot) return <View>{toolbar}{message(t(!validId ? 'library.errors.invalid' : !controller.enabled ? 'library.errors.unsupported' : paused ? 'library.errors.rate-limited' : failed ? `library.errors.${state.failures[id] ?? (controller.enabled ? 'network' : 'unsupported')}` : 'library.loading'), paused || failed || !validId)}
    {failed && validId && controller.enabled && <View style={{ paddingHorizontal: spacing.page }}><AppButton onPress={() => { setFailed(false); setAttempt(value => value + 1) }}>{t('library.readOnline')}</AppButton></View>}
  </View>
  return <View style={{ flex: 1 }} testID="library-reader">
    {toolbar}
    {reading && controller.enabled && validId && <>{!!notice && <View style={{ paddingHorizontal: spacing.page, paddingVertical: spacing.xs }}><ShareNotice notice={notice} /></View>}<ShareManualModal manual={manual} dismiss={dismiss} openerRef={shareAnchor} /></>}
    <PartList parts={parts} following={false} language={preferences.language} selectedLanguages={preferences.selectedLanguages}
      readingSize={preferences.readingSize} manual={() => {}} switchLanguage={setLanguage} header={details}
      topPartChanged={part => setTopKey(part?.key)} open={part => { opener.current = null; setDetail(occurrence(part)) }} />
    <AppModal visible={detail !== null} onDismiss={() => setDetail(null)} openerRef={opener} title={t('library.details')}>
      {detail && <>
        <PartHeading role={detail.role} posture={detail.posture} />
        {detail.page !== null && <AppText variant="caption" tone="muted">{t('library.page', { page: detail.page })}</AppText>}
        <LiturgyText text={detail.requires_session_context && detail.text[preferences.language] === null ? t('library.sessionContext') : detail.text[preferences.language]} language={preferences.language} readingSize={preferences.readingSize} />
        {!detail.explanations.length && <AppText variant="explanation">{t('library.noExplanations')}</AppText>}
        {detail.explanations.map(e => <View key={e.id} style={{ gap: spacing.sm }}>
          <AppText variant="heading">{e.title}</AppText>
          <LiturgyText variant="explanation" text={e.description} blocks />
        </View>)}
      </>}
    </AppModal>
    <AppModal visible={sheet !== null} onDismiss={() => setSheet(null)} openerRef={opener}
      title={sheet === 'language' ? t('reader.readingLanguage') : t('readingPreferences.title')}>
      {sheet === 'language' ? <>
        {preferences.selectedLanguages.map(value => <LanguageSelectionRow key={value} language={value} label={sampleLanguages.find(l => l.value === value)!.label}
          selected={value === preferences.language} onPress={() => { setLanguage(value); setSheet(null) }} />)}
        <AppButton variant="quiet" icon="next" onPress={() => { setSheet(null); router.push('/(tabs)/settings') }}>{t('reader.chooseLanguages')}</AppButton>
      </> : <>
        <AppText variant="label">{t('readingPreferences.appearance')}</AppText>
        <SegmentedControl label={t('readingPreferences.appearance')} value={preferences.appearance} onChange={setAppearance}
          options={[{ value: 'system', label: t('readingPreferences.system') }, { value: 'light', label: t('readingPreferences.light') }, { value: 'dark', label: t('readingPreferences.dark') }]} />
        <AppText variant="label" style={{ marginTop: spacing.md }}>{t('readingPreferences.readingSize')}</AppText>
        <SegmentedControl label={t('readingPreferences.readingSize')} value={preferences.readingSize} onChange={setReadingSize}
          options={[{ value: 'standard', label: t('readingPreferences.standard') }, { value: 'larger', label: t('readingPreferences.larger') }, { value: 'extraLarge', label: t('readingPreferences.extraLarge') }]} />
        <AppText variant="caption" tone="muted">{t('readingPreferences.readingSizeHint')}</AppText>
      </>}
    </AppModal>
  </View>
}
