import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createConfigController, createDisplayLinkApi, createPolledResource, type DisplayLinkApi, type Endpoints } from '@tarkman/reader'
import { linkText, readerText } from './i18n'
import { defaultTransport, lifecycle, type ReaderTransport } from './reader'

/** Public, unauthenticated display-link reads. `request` is injectable for tests. */
export function displayLinkApi(base: string, request?: typeof fetch): DisplayLinkApi {
  return createDisplayLinkApi({ base, text: readerText, linkText, request })
}

/**
 * The saved display's configuration: revisioned HTTP reads plus DisplayLinkChannel events, owned by
 * (environment, token). `attempt` recreates the controller, which is how Retry recovers from a terminal
 * state the engine deliberately stops refreshing.
 */
export function useLinkConfig(endpoints: Endpoints, token: string, transport: ReaderTransport = defaultTransport, request?: typeof fetch, attempt = 0) {
  const controller = useMemo(() => {
    const api = displayLinkApi(endpoints.api, request)
    return createConfigController(token, signal => api.link(token, signal), transport.cable(), endpoints.cable, lifecycle)
    // `attempt` is a deliberate recreation key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints.api, endpoints.cable, token, transport, request, attempt])
  useEffect(() => controller.start(), [controller])
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}

/** The service the church's display should show now, polled while foregrounded; `null` means none is live. */
export function useCurrentSession(endpoints: Endpoints, userId: number, request?: typeof fetch) {
  const controller = useMemo(() => {
    const api = displayLinkApi(endpoints.api, request)
    return createPolledResource(signal => api.currentSession(userId, signal), 5000, lifecycle)
  }, [endpoints.api, userId, request])
  useEffect(() => controller.start(), [controller])
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}
