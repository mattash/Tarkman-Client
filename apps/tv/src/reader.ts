import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { createAppLifecycle, createCable, createReaderApi, createReaderController, validateConfig, type Endpoints, type ReaderApi, type CableClient, type ReaderConfig } from '@tarkman/reader'
import { readerText } from './i18n'

export const lifecycle = createAppLifecycle(AppState, Network)

export function readerConfig(): ReaderConfig {
  return validateConfig(process.env.EXPO_PUBLIC_API_URL, process.env.EXPO_PUBLIC_ACTIONCABLE_URL, __DEV__)
}

/** Injectable for tests; the app uses the public read API and ActionCable. */
export interface ReaderTransport { api(base: string): ReaderApi; cable(): CableClient }
export const defaultTransport: ReaderTransport = { api: base => createReaderApi({ base, text: readerText }), cable: createCable }

/**
 * Read-only: TV never sends commands, authenticates, or keeps an offline copy. Explanations load
 * only when a saved display's configuration asks for its cue. `id` null lists
 * services; a new id creates a new controller, so a previous service's responses can never land.
 */
export function useReader(endpoints: Endpoints, id: number | null, transport: ReaderTransport = defaultTransport, options: { loadExplanations?: boolean } = {}) {
  const loadExplanations = !!options.loadExplanations
  const controller = useMemo(() => createReaderController({
    api: transport.api(endpoints.api), cable: transport.cable(), cableUrl: endpoints.cable,
    lifecycle, id, text: readerText, loadExplanations,
  }), [endpoints.api, endpoints.cable, id, transport, loadExplanations])
  useEffect(() => controller.start(), [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return useMemo(() => ({
    state,
    retry: controller.retry,
    /** Local reading only: suspends following. The broadcast cursor is never touched. */
    readManually: () => { if (controller.getSnapshot().following) controller.dispatch({ type: 'manual' }) },
    returnToLive: () => { controller.dispatch({ type: 'follow' }); controller.retry() },
  }), [controller, state])
}
