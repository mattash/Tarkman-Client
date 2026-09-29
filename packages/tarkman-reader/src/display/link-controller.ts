import type { CableClient } from '../cable'
import type { Lifecycle } from '../adapters'
import type { DisplayLinkConfig } from './config'
import { InvalidDisplayLinkError } from './link-api'
import { completeConfig, configReducer, initialConfigState, type ConfigAction } from './link-state'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Owned by (API environment, token), never by the current service. No mutation/replay. */
export function createConfigController(token: string, load: (signal: AbortSignal) => Promise<DisplayLinkConfig>,
  cable: CableClient, cableUrl: string, lifecycle: Lifecycle) {
  let state = initialConfigState, alive = false, running = false, epoch = 0, queued = false, terminalEpoch = 0
  let request: AbortController | undefined, unsubscribe: (() => void) | undefined
  let poll: ReturnType<typeof setTimeout> | undefined, timeout: ReturnType<typeof setTimeout> | undefined
  let expiry: ReturnType<typeof setTimeout> | undefined, malformedAt = -Infinity
  const listeners = new Set<() => void>()
  function dispatch(action: ConfigAction) {
    const next = configReducer(state, action)
    if (next === state) return
    if (action.type === 'invalid') terminalEpoch++
    state = next; listeners.forEach(listener => listener())
    clearTimeout(expiry)
    const at = state.data?.expires_at ? Date.parse(state.data.expires_at) : NaN
    // Expiry is a hint to read the authority, never a locally invented revocation.
    if (running && Number.isFinite(at) && (at > Date.now() || action.type === 'snapshot')) expiry = setTimeout(() => { void refresh() }, Math.max(0, Math.min(2147483647, at - Date.now() + 1)))
  }
  async function refresh() {
    if (!alive || !running || state.terminal === 'deleted' || state.terminal === 'unavailable') return
    if (request) { queued = true; return }
    clearTimeout(poll)
    const abort = new AbortController(), generation = epoch, terminalGeneration = terminalEpoch
    request = abort
    try {
      const bounded = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { abort.abort(); reject(new Error('timeout')) }, 12000)
      })
      const config = await Promise.race([load(abort.signal), bounded])
      if (!alive || generation !== epoch || terminalGeneration !== terminalEpoch || config.token !== token) return
      if (config.expires_at && Date.parse(config.expires_at) <= Date.now()) {
        dispatch({ type: 'invalid', reason: 'expired', version: config.config_version ?? state.version })
      } else dispatch({ type: 'snapshot', config, canonical: true })
    } catch (error) {
      if (!alive || generation !== epoch || terminalGeneration !== terminalEpoch) return
      dispatch(error instanceof InvalidDisplayLinkError
        ? { type: 'invalid', reason: error.expired ? 'expired' : 'unavailable', version: state.version }
        : { type: 'error', error: error instanceof Error ? error : new Error('configuration') })
    } finally {
      if (generation === epoch) {
        clearTimeout(timeout); request = undefined
        if (alive && running) {
          if (queued) { queued = false; void refresh() }
          else poll = setTimeout(() => { void refresh() }, 10000)
        }
      }
    }
  }
  function stop() {
    running = false; epoch++; queued = false
    request?.abort(); request = undefined
    clearTimeout(poll); clearTimeout(timeout); clearTimeout(expiry)
    unsubscribe?.(); unsubscribe = undefined
  }
  function startResources() {
    running = true
    const generation = epoch
    void refresh()
    unsubscribe = cable.subscribe(cableUrl, { channel: 'DisplayLinkChannel', token }, {
      connected: () => { if (running && epoch === generation) void refresh() },
      disconnected: () => { /* Serial GET remains authoritative for rejected/old channels. */ },
      received(value) {
        if (!alive || !running || epoch !== generation) return
        const event = asRecord(value), data = asRecord(event.data)
        if (typeof data.token === 'string' && data.token !== token) return
        if (event.event === 'display_link.updated') {
          const config = completeConfig(data)
          if (config?.token === token) {
            if (state.terminal === 'expired') void refresh()
            else dispatch({ type: 'snapshot', config })
            return
          }
        } else if (event.event === 'display_link.invalidated' && data.token === token &&
          Number.isSafeInteger(data.config_version) && Number(data.config_version) >= 0 && (data.reason === 'deleted' || data.reason === 'expired')) {
          dispatch({ type: 'invalid', version: Number(data.config_version), reason: data.reason }); return
        }
        // Malformed bursts cannot drive unbounded immediate requests.
        if (Date.now() - malformedAt >= 10000) { malformedAt = Date.now(); void refresh() }
      },
    })
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      alive = true
      const unlisten = lifecycle.listen((active, online) => {
        const ready = active && online
        if (ready === running) return
        stop(); if (ready) startResources()
      })
      return () => { alive = false; stop(); unlisten() }
    },
  }
}
