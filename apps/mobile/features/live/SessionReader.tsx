import { useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { spacing } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import type { Endpoints } from './config'
import { currentPart } from './contracts'
import { useReader } from './useReader'
import { PartList } from './PartList'
import { ReaderStatus } from './ReaderStatus'
export function SessionReader({ endpoints, id, back }: { endpoints: Endpoints; id: number; back(): void }) {
  const { state, retry, dispatch } = useReader(endpoints, id)
  const [language, setLanguage] = useState<Language>('en'), [sheet, setSheet] = useState<'language' | 'explanation' | null>(null)
  const languageOpener = useRef<View>(null), explanationOpener = useRef<View>(null), activeOpener = useRef<View>(null)
  const part = state.session ? currentPart(state.session, state.parts) : undefined
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
        <AppButton ref={languageOpener} variant="secondary" onPress={() => { activeOpener.current = languageOpener.current; setSheet('language') }} accessibilityLabel="Choose reading language">{sampleLanguages.find(l => l.value === language)!.label}</AppButton>
        <AppButton ref={explanationOpener} variant="secondary" disabled={!part} onPress={() => { activeOpener.current = explanationOpener.current; setSheet('explanation') }}>Explain current part</AppButton>
      </View>
      {state.session && !part && !state.loading && <AppText variant="caption">The current part is not available. You can browse the readings.</AppText>}
    </ScrollView>
    {!state.loading && <PartList parts={state.parts} currentKey={part?.key} following={state.following} language={language} manual={() => dispatch({ type: 'manual' })} />}
    <AppModal visible={sheet !== null} title={sheet === 'language' ? 'Reading language' : 'Current part explanation'} openerRef={activeOpener} onDismiss={() => setSheet(null)}>
      {sheet === 'language' ? sampleLanguages.map(item => <AppButton key={item.value} variant={item.value === language ? 'primary' : 'secondary'} accessibilityState={{ selected: item.value === language }} onPress={() => { setLanguage(item.value); setSheet(null) }}>{item.label}</AppButton>) : <>
        <AppText variant="caption" tone="muted">Explanations follow the service’s current part, even while you read elsewhere.</AppText>
        <AppText variant="label">{part ? `${part.position} / ${part.role}` : 'Current part unavailable'}</AppText>
        {state.stale ? <AppText>Reconnecting. Explanations will refresh with the current part.</AppText> : state.explanationError ? <><AppText accessibilityRole="alert">Could not load explanations.</AppText><AppButton loading={state.refreshing} onPress={retry}>Retry explanations</AppButton></> : state.explanations.length === 0 ? <AppText>No explanation is available for this part.</AppText> : state.explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}><AppText variant="heading">{explanation.title}</AppText><LiturgyText text={explanation.description} /></View>)}
      </>}
    </AppModal>
  </View>
}
