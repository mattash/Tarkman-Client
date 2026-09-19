import { useEffect, useState } from 'react'
import { lifecycle } from '../live/lifecycle'
import { InvalidDisplayLinkError } from './api'

/** Serial, bounded polling; identity changes discard old results before the next effect. */
export function useDisplayResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, interval: number) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: Error }>({ key })
  useEffect(() => {
    let disposed = false, active = false, online = false, generation = 0
    let request: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    function stop() {
      generation++
      request?.abort(); request = undefined
      clearTimeout(timer); clearTimeout(timeout)
    }
    async function refresh() {
      if (disposed || !active || !online || request) return
      const abort = new AbortController(), epoch = generation
      request = abort
      // Race the request as well as aborting it: an unresponsive fetch must not stall a kiosk forever.
      try {
        const expired = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => { abort.abort(); reject(new Error('timeout')) }, 12000)
        })
        const data = await Promise.race([load(abort.signal), expired])
        if (!disposed && epoch === generation) setResult({ key, data })
      } catch (error) {
        if (!disposed && epoch === generation) setResult(previous => ({ key,
          data: error instanceof InvalidDisplayLinkError ? undefined : previous.key === key ? previous.data : undefined,
          error: error instanceof Error ? error : new Error('request failed'),
        }))
      } finally {
        if (!disposed && epoch === generation) {
          clearTimeout(timeout); request = undefined
          timer = setTimeout(() => { void refresh() }, interval)
        }
      }
    }
    const unlisten = lifecycle.listen((nextActive, nextOnline) => {
      if (active === nextActive && online === nextOnline) return
      active = nextActive; online = nextOnline; stop()
      if (active && online) void refresh()
    })
    return () => { disposed = true; stop(); unlisten() }
  }, [key, load, interval])
  return result.key === key ? result : { key }
}
