import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { createAppLifecycle, createCable, createReaderApi, createReaderController, validateConfig, type Endpoints, type ReaderConfig } from '@tarkman/reader'
import { readerText } from './text'

export const lifecycle = createAppLifecycle(AppState, Network)

export function readerConfig(): ReaderConfig {
  return validateConfig(process.env.EXPO_PUBLIC_API_URL, process.env.EXPO_PUBLIC_ACTIONCABLE_URL, __DEV__)
}

/** Read-only: TV never sends commands, authenticates, or keeps an offline copy. */
export function useReader(endpoints: Endpoints, id: number | null) {
  const controller = useMemo(() => createReaderController({
    api: createReaderApi({ base: endpoints.api, text: readerText }), cable: createCable(), cableUrl: endpoints.cable,
    lifecycle, id, text: readerText, loadExplanations: false,
  }), [endpoints.api, endpoints.cable, id])
  useEffect(() => controller.start(), [controller])
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}
