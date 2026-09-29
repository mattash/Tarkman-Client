import { useCallback, useEffect, useRef, useState } from 'react'

export type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown }

/**
 * One request per key, aborted when the key changes or the screen leaves, and a result from an older
 * request can never land on a newer one. `reload` retries the same key.
 */
export function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>): [LoadState<T>, () => void] {
  // A result belongs to one (key, attempt); anything older reads as loading, so no reset is needed.
  const [state, setState] = useState<{ key: string; attempt: number; value: LoadState<T> } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(load)
  useEffect(() => { latest.current = load })
  useEffect(() => {
    const abort = new AbortController()
    latest.current(abort.signal).then(
      data => { if (!abort.signal.aborted) setState({ key, attempt, value: { status: 'ready', data } }) },
      error => { if (!abort.signal.aborted) setState({ key, attempt, value: { status: 'error', error } }) },
    )
    return () => abort.abort()
  }, [key, attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return [state && state.key === key && state.attempt === attempt ? state.value : { status: 'loading' }, reload]
}
