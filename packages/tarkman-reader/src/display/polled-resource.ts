import type { Lifecycle } from '../adapters'
import { InvalidDisplayLinkError } from './link-api'

export interface PolledResourceState<T> { data?: T; error?: Error }

/**
 * Serial, bounded polling that runs only while the app is active and online. An unresponsive fetch
 * must not stall a kiosk, so each request is raced against a timeout as well as aborted. A terminal
 * invalid-link error clears the data; any other failure keeps the last good value beside the error.
 */
export function createPolledResource<T>(load: (signal: AbortSignal) => Promise<T>, interval: number, lifecycle: Lifecycle) {
  let state: PolledResourceState<T> = {}
  let disposed = false, active = false, online = false, generation = 0
  let request: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined, timeout: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  function set(next: PolledResourceState<T>) { state = next; listeners.forEach(listener => listener()) }
  function stop() {
    generation++
    request?.abort(); request = undefined
    clearTimeout(timer); clearTimeout(timeout)
  }
  async function refresh() {
    if (disposed || !active || !online || request) return
    const abort = new AbortController(), epoch = generation
    request = abort
    try {
      const expired = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { abort.abort(); reject(new Error('timeout')) }, 12000)
      })
      const data = await Promise.race([load(abort.signal), expired])
      if (!disposed && epoch === generation) set({ data })
    } catch (error) {
      if (!disposed && epoch === generation) set({
        data: error instanceof InvalidDisplayLinkError ? undefined : state.data,
        error: error instanceof Error ? error : new Error('request failed'),
      })
    } finally {
      if (!disposed && epoch === generation) {
        clearTimeout(timeout); request = undefined
        timer = setTimeout(() => { void refresh() }, interval)
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      // A stopped resource can be started again (Strict Mode, Fast Refresh): begin from a clean slate so
      // the lifecycle's first callback is not mistaken for "no change".
      disposed = false; active = false; online = false
      const unlisten = lifecycle.listen((nextActive, nextOnline) => {
        if (active === nextActive && online === nextOnline) return
        active = nextActive; online = nextOnline; stop()
        if (active && online) void refresh()
      })
      return () => { disposed = true; stop(); unlisten() }
    },
  }
}
