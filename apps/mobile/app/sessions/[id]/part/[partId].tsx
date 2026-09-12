import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../../../../components/AppButton'
import { AppText } from '../../../../components/AppText'
import { LiturgyText } from '../../../../components/LiturgyText'
import { Card } from '../../../../components/Surface'
import { spacing } from '../../../../design/tokens'
import { readerConfig } from '../../../../features/live/config'
import { createPartsApi, type PartDetail, type PartExplanation } from '../../../../features/parts/api'

const TEXTS: { key: keyof PartDetail['texts']; label: string; language?: 'grabar' | 'translit' | 'en' | 'ru' }[] = [
  { key: 'grabar', label: 'Classical Armenian', language: 'grabar' },
  { key: 'translit', label: 'Transliteration', language: 'translit' },
  { key: 'en', label: 'English', language: 'en' },
  { key: 'ru', label: 'Russian', language: 'ru' },
  { key: 'hyEast', label: 'Eastern Armenian' },
  { key: 'hyWest', label: 'Western Armenian' },
]

interface PartState { part?: PartDetail; explanations: PartExplanation[]; loading: boolean; error?: string; explanationError: boolean }

export default function PartDetailScreen() {
  const { id, partId } = useLocalSearchParams<{ id?: string; partId?: string }>()
  const sessionId = Number(id), part = Number(partId)
  const config = readerConfig()
  const valid = config.endpoints && Number.isInteger(sessionId) && sessionId > 0 && Number.isInteger(part) && part > 0
  const [state, setState] = useState<PartState>({ explanations: [], loading: true, explanationError: false })
  const [attempt, setAttempt] = useState(0)
  const api = config.endpoints?.api

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
      setState({ explanations: [], loading: false, explanationError: false, error: failure instanceof Error ? failure.message : 'Could not load this part. Please retry.' })
    })
    return () => controller.abort()
  }, [api, valid, sessionId, part, attempt])

  const back = () => { if (router.canGoBack()) { router.back() } else { router.replace(`/sessions/${sessionId}/parts`) } }
  if (!valid) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{config.endpoints ? 'That part link is not valid.' : config.error}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/')}>All services</AppButton>
    </ScrollView>
  }

  return <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" onPress={back}>Back to the service</AppButton>
      </View>
      {state.loading && <ActivityIndicator accessibilityLabel="Loading this part" />}
      {state.error && <Card><AppText accessibilityRole="alert">{state.error}</AppText>
        <AppButton variant="secondary" onPress={() => { setState({ explanations: [], loading: true, explanationError: false }); setAttempt(count => count + 1) }}>Retry</AppButton></Card>}
      {state.part && <>
        <AppText variant="title">{state.part.position ? `${state.part.position} / ${state.part.role}` : state.part.role}</AppText>
        {state.part.posture && <AppText tone="muted">{`Posture: ${state.part.posture}`}</AppText>}
        {TEXTS.filter(entry => state.part!.texts[entry.key]).map(entry => <Card key={entry.key}>
          <AppText variant="label" tone="accent">{entry.label}</AppText>
          <LiturgyText language={entry.language} text={state.part!.texts[entry.key]} />
        </Card>)}
        {state.explanationError && <AppText variant="caption" accessibilityRole="alert">Some explanations could not be loaded.</AppText>}
        {state.explanations.length > 0 && <AppText variant="heading">Explanations</AppText>}
        {state.explanations.map(explanation => <Card key={explanation.id}>
          <AppText variant="label">{explanation.title}</AppText>
          <LiturgyText text={explanation.description} />
        </Card>)}
        {!state.loading && state.explanations.length === 0 && !state.explanationError && <AppText tone="muted">No explanation is available for this part.</AppText>}
      </>}
    </View>
  </ScrollView>
}
