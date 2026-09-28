// Capabilities the reader engine needs from its host app. The engine imports no platform module;
// each app supplies these once, so the recovery algorithm exists in exactly one place.

/** Every piece of reader-facing copy the engine produces. Apps map these to their own catalogs. */
export type ReaderMessageKey =
  | 'common.serviceNoLongerAvailable'
  | 'errors.duplicatePart' | 'errors.loadService' | 'errors.missingIdentifier' | 'errors.noNetwork'
  | 'errors.refreshService' | 'errors.unexpectedExplanations' | 'errors.unexpectedFormat'
  | 'errors.unexpectedParts' | 'errors.unexpectedServices' | 'errors.unexpectedSession'
  | 'fallbacks.churchService' | 'fallbacks.explanation' | 'fallbacks.reading' | 'fallbacks.service'

/** Resolved at call time, so a host that changes language at runtime is honoured on the next message. */
export type ReaderText = (key: ReaderMessageKey) => string

export type ReaderFields = Record<string, string | number | boolean | null | undefined>
/** Opaque to the engine: only the observability adapter reads a trace. */
export type ReaderTrace = object

/**
 * Optional diagnostics. Marks must never throw into reading, never carry content, and cost nothing when
 * disabled. Traces follow a recovery through its AbortSignal so fetches can be correlated with it.
 * Methods are called unbound; do not rely on `this`.
 */
export interface ReaderObservability {
  context(sessionId?: number | null): ReaderTrace | undefined
  mark(name: string, fields?: ReaderFields, trace?: ReaderTrace): void
  beginRecovery(sessionId: number | null, signal: AbortSignal, reason: string): ReaderTrace | undefined
  inheritRecovery(signal: AbortSignal, parent: AbortSignal): void
  recoveryContext(signal: AbortSignal): ReaderTrace | undefined
  headers(trace?: ReaderTrace): Record<string, string>
  cable(value: unknown, sessionId: number): void
}

export const silentObservability: ReaderObservability = {
  context: () => undefined,
  mark: () => {},
  beginRecovery: () => undefined,
  inheritRecovery: () => {},
  recoveryContext: () => undefined,
  headers: () => ({}),
  cable: () => {},
}

export interface Lifecycle {
  listen(callback: (active: boolean, online: boolean) => void): () => void
}

/** The subset of React Native's AppState the lifecycle uses. Passed in, never imported. */
export interface AppStateSource {
  readonly currentState: string | null | undefined
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void }
}
export interface NetworkStateLike { isConnected?: boolean | null; isInternetReachable?: boolean | null }
/** The subset of expo-network the lifecycle uses. Passed in, never imported. */
export interface NetworkSource {
  addNetworkStateListener(listener: (state: NetworkStateLike) => void): { remove(): void }
  getNetworkStateAsync(): Promise<NetworkStateLike>
}

/** Foreground and reachability, from the host's AppState and network modules. */
export function createAppLifecycle(app: AppStateSource, network: NetworkSource): Lifecycle {
  return {
    listen(callback) {
      let disposed = false, active = app.currentState !== 'background' && app.currentState !== 'inactive', online = true, networkEvent = false
      const updateNetwork = (state: NetworkStateLike) => {
        if (disposed) return
        online = state.isConnected !== false && state.isInternetReachable !== false
        callback(active, online)
      }
      const appSubscription = app.addEventListener('change', state => { active = state === 'active'; callback(active, online) })
      const networkSubscription = network.addNetworkStateListener(state => { networkEvent = true; updateNetwork(state) })
      callback(active, online)
      void network.getNetworkStateAsync().then(state => { if (!networkEvent) updateNetwork(state) }, () => { /* Fetch remains the authority for reachability. */ })
      return () => { disposed = true; appSubscription.remove(); networkSubscription.remove() }
    },
  }
}
