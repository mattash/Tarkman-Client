import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnauthorized } from '../auth/AuthProvider'
import { lifecycle } from '../live/lifecycle'
import { isStalePart } from './controls'

export interface ControlsState { running: string | null; error: string | null; online: boolean }

const OFFLINE_ERROR = 'You are offline. Reconnect before changing the service.'

/**
 * Runs one control command at a time and refuses to send any while offline, so a command cannot
 * be duplicated by a second press or replayed later against a service that has moved on.
 */
export function useControls(refresh: () => void) {
  const [state, setState] = useState<ControlsState>({ running: null, error: null, online: true })
  const running = useRef<string | null>(null)
  const online = useRef(true)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => lifecycle.listen((_active, connected) => {
    online.current = connected
    setState(current => current.online === connected ? current : { ...current, online: connected })
  }), [])

  const run = useCallback(async (name: string, command: () => Promise<void>) => {
    if (running.current) return
    if (!online.current) { setState(current => ({ ...current, error: OFFLINE_ERROR })); return }
    running.current = name
    setState(current => ({ ...current, running: name, error: null }))
    try {
      await command()
      refresh()
      if (mounted.current) setState(current => ({ ...current, running: null }))
    } catch (failure) {
      // An ended sign-in is handled by the signed-in layout, which returns to the sign-in screen.
      // A refused stale move means this screen is behind, so pull the current state before the next command.
      if (isStalePart(failure)) refresh()
      const message = isUnauthorized(failure) ? null : failure instanceof Error ? failure.message : 'Could not update the service. Please try again.'
      if (mounted.current) setState(current => ({ ...current, running: null, error: message }))
    } finally {
      running.current = null
    }
  }, [refresh])

  return { ...state, run }
}
