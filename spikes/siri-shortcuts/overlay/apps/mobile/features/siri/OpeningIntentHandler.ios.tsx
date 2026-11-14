import { useMemo } from 'react'
import { router, useRootNavigationState } from 'expo-router'
import { removePendingInvocationAsync, useAppIntents } from 'expo-app-intents'
import { useLibrary } from '../library/LibraryProvider'
import { createOpeningConsumer } from './openingInvocations'

/** Mounted only by the explicitly isolated Siri spike build. No background JS. */
export function OpeningIntentHandler() {
  const navigation = useRootNavigationState()
  const { state } = useLibrary()
  return navigation?.key && state.ready ? <ReadyOpeningIntentHandler /> : null
}

function ReadyOpeningIntentHandler() {
  const consume = useMemo(() => createOpeningConsumer(path => router.replace(path), removePendingInvocationAsync), [])
  useAppIntents(consume)
  return null
}
