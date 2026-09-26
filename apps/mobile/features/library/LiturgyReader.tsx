import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { BackButton } from '../../components/BackButton'
import { LiturgyText } from '../../components/LiturgyText'
import { SegmentedControl } from '../../components/SegmentedControl'
import { spacing } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import { PartList } from '../live/PartList'
import type { LivePart } from '../live/contracts'
import { usePreferences } from '../preferences/PreferencesProvider'
import { useI18n } from '../i18n'
import { useLibrary } from './LibraryProvider'
import type { Bundle, Occurrence } from './contracts'

/** Pins one complete immutable revision. No SessionReader/controller/presence dependency. */
export function LiturgyReader() {
  const params = useLocalSearchParams<{ id: string; environment: string; origin?: string }>()
  const { controller } = useLibrary()
  return <Reader key={`${params.environment}:${params.id}:${controller.environment}`} id={Number(params.id)} environment={params.environment} origin={params.origin} />
}
function Reader({ id, environment, origin }: { id: number; environment: string; origin?: string }) {
  const { controller, state } = useLibrary(), { t } = useI18n()
  const { preferences, setLanguage, setReadingSize } = usePreferences()
  const sameEnvironment = environment === controller.environment
  const validId = Number.isSafeInteger(id) && id > 0
  const [attempt, setAttempt] = useState(0)
  const stored = state.items.find(i => i.id === id)
  const [snapshot, setSnapshot] = useState<{ bundle: Bundle; savedAt: number | null } | null>(() => stored?.bundle && sameEnvironment ? { bundle: stored.bundle, savedAt: stored.savedAt } : null)
  const [failed, setFailed] = useState(false), [detail, setDetail] = useState<Occurrence | null>(null)
  useEffect(() => {
    let active = true
    if (snapshot || !state.ready || !sameEnvironment || !validId || controller.getSnapshot().revoked.includes(id)) return
    const saved = controller.getSnapshot().items.find(i => i.id === id)
    if (saved?.bundle) {
      void Promise.resolve().then(() => { if (active) setSnapshot({ bundle: saved.bundle!, savedAt: saved.savedAt }) })
      return () => { active = false }
    }
    void controller.request(id, false).then(bundle => {
      if (active) { if (bundle) setSnapshot({ bundle, savedAt: null }); else setFailed(true) }
    }, () => { if (active) setFailed(true) })
    return () => { active = false }
  }, [controller, id, sameEnvironment, state.ready, attempt, validId, snapshot])
  const revoked = state.revoked.includes(id)
  if (revoked && snapshot) setSnapshot(null)
  const parts = useMemo<LivePart[]>(() => snapshot?.bundle.parts.map(p => ({
    id: p.part_id, key: `library:${p.liturgy_part_id}`, liturgyId: p.liturgy_id, liturgyPartId: p.liturgy_part_id,
    position: p.position, role: p.role, posture: p.posture, page: p.page,
    text: { en: p.requires_session_context && p.text.en === null ? t('library.sessionContext') : p.text.en,
      ru: p.text.ru, grabar: p.text.grabar, translit: p.text.translit },
  })) ?? [], [snapshot, t])
  const header = <View style={{ padding: spacing.page, gap: spacing.sm }}>
    <BackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/live') }}>{t(router.canGoBack() ? origin === 'library' ? 'library.back' : 'onboarding.back' : 'servicesList.title')}</BackButton>
    {snapshot && sameEnvironment && !revoked && <>
      <AppText variant="heading">{snapshot.bundle.liturgy.name}</AppText>
      <AppText tone="muted">{snapshot.savedAt && stored?.bundle ? t('library.downloaded') : t('library.online')}</AppText>
      {stored?.bundle && stored.bundle.revision !== snapshot.bundle.revision && <AppText accessibilityLiveRegion="polite">{t('library.reopen')}</AppText>}
      <SegmentedControl label={t('settings.readingLanguages')} value={preferences.language} onChange={setLanguage}
        options={preferences.selectedLanguages.map(value => sampleLanguages.find(language => language.value === value)!)} />
      <SegmentedControl label={t('readingPreferences.readingSize')} value={preferences.readingSize} onChange={setReadingSize}
        options={[{ value: 'standard', label: t('readingPreferences.standard') }, { value: 'larger', label: t('readingPreferences.larger') }, { value: 'extraLarge', label: t('readingPreferences.extraLarge') }]} />
      <AppButton variant="quiet" onPress={() => router.push('/(tabs)/settings')}>{t('settings.readingLanguages')}</AppButton>
    </>}
  </View>
  if (revoked || !sameEnvironment) return <View>{header}<AppText accessibilityRole="alert">{t('library.errors.unavailable')}</AppText></View>
  if (!snapshot) return <View>{header}<AppText accessibilityRole={failed || !validId ? 'alert' : undefined}>{t(!validId ? 'library.errors.invalid' : failed ? `library.errors.${state.failures[id] ?? (controller.enabled ? 'network' : 'unsupported')}` : 'library.loading')}</AppText>
    {failed && validId && <AppButton onPress={() => { setFailed(false); setAttempt(value => value + 1) }}>{t('library.readOnline')}</AppButton>}
  </View>
  return <View style={{ flex: 1 }} testID="library-reader">
    <PartList parts={parts} following={false} language={preferences.language} selectedLanguages={preferences.selectedLanguages}
      readingSize={preferences.readingSize} manual={() => {}} switchLanguage={setLanguage} header={header}
      open={part => setDetail(snapshot.bundle.parts.find(p => p.liturgy_part_id === part.liturgyPartId) ?? null)} />
    <AppModal visible={detail !== null} onDismiss={() => setDetail(null)} title={t('library.details')}>
      {detail && <>
        <AppText>{detail.role}</AppText>
        {detail.posture && <AppText>{detail.posture}</AppText>}
        <AppText>{detail.page === null ? t('library.unknownPage') : t('library.page', { page: detail.page })}</AppText>
        {detail.requires_session_context && <AppText>{t('library.sessionContext')}</AppText>}
        <LiturgyText text={detail.text[preferences.language]} language={preferences.language} readingSize={preferences.readingSize} />
        {!detail.explanations.length && <AppText>{t('library.noExplanations')}</AppText>}
        {detail.explanations.map(e => <View key={e.id} style={{ gap: spacing.sm }}>
          <AppText variant="heading">{e.title}</AppText>
          <LiturgyText text={e.description} language={preferences.language} readingSize={preferences.readingSize} />
        </View>)}
      </>}
    </AppModal>
  </View>
}
