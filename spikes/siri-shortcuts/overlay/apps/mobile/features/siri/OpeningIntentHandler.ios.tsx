import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'
import { router, useRootNavigationState } from 'expo-router'
import { isAvailable, removePendingInvocationAsync, useAppIntents } from 'expo-app-intents'
import { useLibrary } from '../library/LibraryProvider'
import { createOpeningConsumer } from './openingInvocations'
import { recordSpikeDiagnostic } from './spikeDiagnostics'

/** Mounted only by the explicitly isolated Siri spike build. No background JS. */
export function OpeningIntentHandler() {
  const navigation = useRootNavigationState()
  const { state } = useLibrary()
  const ready = Boolean(navigation?.key) && state.ready
  useEffect(() => { recordSpikeDiagnostic(isAvailable() ? 'module:available' : 'module:unavailable') }, [])
  useEffect(() => { recordSpikeDiagnostic(ready ? 'root:ready' : 'root:waiting') }, [ready])
  useEffect(() => {
    const record = (state: string | null | undefined) => recordSpikeDiagnostic(['active', 'inactive', 'background'].includes(state ?? '') ? `app:${state}` : 'app:unknown')
    record(AppState.currentState)
    const subscription = AppState.addEventListener('change', record)
    return () => subscription.remove()
  }, [])
  return ready ? <ReadyOpeningIntentHandler /> : null
}

function ReadyOpeningIntentHandler() {
  const consume = useMemo(() => createOpeningConsumer(path => router.replace(path), removePendingInvocationAsync, recordSpikeDiagnostic), [])
  useAppIntents(consume)
  return null
}
