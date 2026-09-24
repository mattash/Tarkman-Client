import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Platform, Pressable, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../../../../components/AppButton'
import { BackButton } from '../../../../components/BackButton'
import { AppText } from '../../../../components/AppText'
import { LiturgyText } from '../../../../components/LiturgyText'
import { Notice } from '../../../../components/Notice'
import { capitalized, PartHeading } from '../../../../components/PartHeading'
import { StatusPill } from '../../../../components/StatusPill'
import { useTheme } from '../../../../design/ThemeProvider'
import { spacing } from '../../../../design/tokens'
import { readerConfig } from '../../../../features/live/config'
import { movedPast, useLivePosition } from '../../../../features/live/livePosition'
import { createPartsApi, type PartDetail, type PartExplanation } from '../../../../features/parts/api'
import { usePreferences } from '../../../../features/preferences/PreferencesProvider'
import { t as translateActive, useI18n, type MessageKey } from '../../../../features/i18n'

// `native` and `eyebrow` name each language in its own script; `label` is the spoken name in the interface language, pronounceable
// without an Armenian voice. Transliteration has no script of its own, so its eyebrow comes from the catalog.
const TEXTS: { key: keyof PartDetail['texts']; label: MessageKey; native: string; eyebrow?: string; language?: 'grabar' | 'translit' | 'en' | 'ru' }[] = [
  { key: 'grabar', label: 'languageNames.grabar', native: 'Գրաբար', eyebrow: 'ԳՐԱԲԱՐ', language: 'grabar' },
  { key: 'translit', label: 'languageNames.translit', native: 'Translit', language: 'translit' },
  { key: 'en', label: 'languageNames.en', native: 'English', eyebrow: 'ENGLISH', language: 'en' }, // i18n-ignore: each language's own name
  { key: 'ru', label: 'languageNames.ru', native: 'Русский', eyebrow: 'РУССКИЙ', language: 'ru' },
  { key: 'hyEast', label: 'languageNames.hyEast', native: 'Արևելահայերեն', eyebrow: 'ԱՐԵՎԵԼԱՀԱՅԵՐԵՆ' },
  { key: 'hyWest', label: 'languageNames.hyWest', native: 'Արեւմտահայերէն', eyebrow: 'ԱՐԵՒՄՏԱՀԱՅԵՐԷՆ' },
]

interface PartState { part?: PartDetail; explanations: PartExplanation[]; loading: boolean; error?: string; explanationError: boolean }

export default function PartDetailScreen() {
  const { id, partId, key: readKey, role: listedRole, posture: listedPosture, service } = useLocalSearchParams<{ id?: string; partId?: string; key?: string; role?: string; posture?: string; service?: string }>()
  const sessionId = Number(id), part = Number(partId)
  const config = readerConfig()
  const valid = config.endpoints && Number.isInteger(sessionId) && sessionId > 0 && Number.isInteger(part) && part > 0
  const [state, setState] = useState<PartState>({ explanations: [], loading: true, explanationError: false })
  const [attempt, setAttempt] = useState(0)
  const api = config.endpoints?.api
  const { preferences } = usePreferences()
  const { colors } = useTheme()
  const { t } = useI18n()
  const scroll = useRef<ScrollView>(null)
  const offsets = useRef({ column: 0, texts: 0, sections: {} as Record<string, number> })
  const labels = useRef<Record<string, View | null>>({})
  const live = useLivePosition(sessionId)
  const livePart = movedPast(live, readKey)
  const [dismissedKey, setDismissedKey] = useState<string | undefined>(undefined)
  const nudge = livePart && livePart.key !== dismissedKey ? livePart : undefined

  useEffect(() => {
    if (!valid || !api) return
    const controller = new AbortController()
    const parts = createPartsApi(api)
    parts.part(sessionId, part, controller.signal).then(async detail => {
      // Explanations are per part; one failing must not hide the reading itself.
      const results = await Promise.allSettled(detail.explanationIds.map(explanationId => parts.explanation(sessionId, explanationId, controller.signal)))
      if (controller.signal.aborted) return
      setState({
        part: detail, loading: false, explanationError: results.some(result => result.status === 'rejected'),
        explanations: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
      })
    }, failure => {
      if (controller.signal.aborted) return
      setState({ explanations: [], loading: false, explanationError: false, error: failure instanceof Error ? failure.message : translateActive('part.loadFailed') })
    })
    return () => controller.abort()
  }, [api, valid, sessionId, part, attempt])

  // Polite: a reader mid-prayer hears it when VoiceOver is free, never as an interruption.
  const nudgeMessage = nudge ? t('part.movedTo', { role: capitalized(nudge.role) }) : undefined
  useEffect(() => {
    if (nudgeMessage && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions?.(nudgeMessage, { queue: true })
  }, [nudgeMessage])

  const back = () => { if (router.canGoBack()) { router.back() } else { router.replace(`/sessions/${sessionId}/parts`) } }
  if (!valid) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{config.endpoints ? t('part.invalidLink') : config.error}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/')}>{t('common.allServices')}</AppButton>
    </ScrollView>
  }

  const role = state.part?.role ?? listedRole
  const posture = state.part ? state.part.posture : listedPosture
  const texts = state.part ? orderedTexts(state.part.texts, preferences.language) : []
  const jump = (key: string) => {
    const { column, texts: top, sections } = offsets.current
    scroll.current?.scrollTo({ y: column + top + (sections[key] ?? 0), animated: true })
    const label = labels.current[key]
    const handle = label && Platform.OS !== 'web' ? findNodeHandle(label) : null
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }

  return <View style={{ flex: 1 }}>
    <ScrollView testID="part-detail" ref={scroll} contentContainerStyle={{ padding: spacing.page, paddingBottom: spacing.xxl }}
      onScrollBeginDrag={() => { if (nudge) setDismissedKey(nudge.key) }}>
      <View onLayout={event => { offsets.current.column = event.nativeEvent.layout.y }}
        style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
        <View style={{ alignSelf: 'flex-start', marginLeft: -spacing.sm }}>
          <BackButton onPress={back} accessibilityHint={t('part.returnsHint')}>{service ?? t('common.backToService')}</BackButton>
        </View>
        {role ? <PartHeading role={role} posture={posture} /> : null}

        {state.error && <View style={{ gap: spacing.sm }}>
          <Notice tone="danger" accessibilityRole="alert">{state.error}</Notice>
          <AppButton variant="secondary" onPress={() => { setState({ explanations: [], loading: true, explanationError: false }); setAttempt(count => count + 1) }}>{t('common.retry')}</AppButton>
          <AppButton variant="quiet" onPress={back}>{t('common.backToService')}</AppButton>
        </View>}

        {state.loading && <ActivityIndicator accessibilityLabel={t('part.loading')} style={{ alignSelf: 'flex-start', paddingVertical: spacing.lg }} />}

        {texts.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.page }}
          contentContainerStyle={{ paddingHorizontal: spacing.page, gap: spacing.sm }}>
          {texts.map((entry, index) => <LanguageChip key={entry.key} entry={entry} filled={index === 0 && entry.key === preferences.language} onPress={() => jump(entry.key)} />)}
        </ScrollView>}

        {texts.length > 0 && <View testID="part-texts" onLayout={event => { offsets.current.texts = event.nativeEvent.layout.y }}>
          {texts.map(entry => <View key={entry.key} testID={`part-text-${entry.key}`} onLayout={event => { offsets.current.sections[entry.key] = event.nativeEvent.layout.y }}
            style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.lg, gap: spacing.sm }}>
            <View ref={view => { labels.current[entry.key] = view }} accessible accessibilityLabel={t(entry.label)}>
              <AppText variant="eyebrow" tone="muted" language={entry.language === 'grabar' ? 'grabar' : undefined}>{entry.eyebrow ?? t('languageNames.translitEyebrow')}</AppText>
            </View>
            <LiturgyText language={entry.language} text={state.part!.texts[entry.key]} readingSize={preferences.readingSize} compactStanzas />
          </View>)}
        </View>}

        {state.part && <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.lg, gap: spacing.lg }}>
          {state.explanations.length > 0 && <AppText variant="heading">{t('common.explanation')}</AppText>}
          {state.explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}>
            <AppText variant="rowTitle" accessibilityRole="header">{explanation.title}</AppText>
            <LiturgyText variant="explanation" text={explanation.description} blocks />
          </View>)}
          {state.explanationError && <StatusPill tone="warning" label={t('part.someExplanationsFailed')} />}
          {state.explanations.length === 0 && !state.explanationError && <AppText tone="muted">{t('common.noPartExplanation')}</AppText>}
        </View>}
      </View>
    </ScrollView>
    {nudge && <View testID="part-return-to-live" accessibilityLiveRegion="polite"
      style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background }}>
      <AppText variant="caption" tone="muted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{nudgeMessage!}</AppText>
      <View style={{ backgroundColor: colors.surface, borderRadius: 999 }}>
        <AppButton icon="live" rounded size="hero" variant="secondary" accessibilityLabel={t('part.goThereLabel', { message: nudgeMessage! })}
          onPress={() => { live?.follow(); back() }}>{t('part.goThere')}</AppButton>
      </View>
    </View>}
  </View>
}

function LanguageChip({ entry, filled, onPress }: { entry: typeof TEXTS[number]; filled: boolean; onPress(): void }) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [pressed, setPressed] = useState(false)
  return <Pressable accessibilityRole="button" accessibilityLabel={t('part.chipLabel', { language: t(entry.label) })} accessibilityState={{ selected: filled }}
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} hitSlop={{ top: 6, bottom: 6 }}
    style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1,
      borderColor: filled ? colors.secondary : colors.border,
      backgroundColor: pressed ? colors.pressedSubtle : filled ? colors.secondary : colors.surface }}>
    <AppText variant="label" language={entry.language === 'grabar' ? 'grabar' : undefined}
      style={{ color: filled && !pressed ? colors.onSecondary : colors.foreground }}>{entry.native}</AppText>
  </Pressable>
}

/** The reader's language first, then the rest in TEXTS order, which puts Grabar next. Absent languages are left out. */
function orderedTexts(texts: PartDetail['texts'], language: string) {
  const present = TEXTS.filter(entry => texts[entry.key])
  const lead = present.find(entry => entry.key === language)
  return lead ? [lead, ...present.filter(entry => entry !== lead)] : present
}
