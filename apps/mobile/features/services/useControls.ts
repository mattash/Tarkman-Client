import type { SessionState } from '../live/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnauthorized } from '../auth/AuthProvider'
import { lifecycle } from '../live/lifecycle'
import { isControlForbidden, isStalePart } from './controls'
import { t } from '../i18n'

export interface ControlsState {
  running: string | null; error: string | null; online: boolean
  /** The command whose failure `error` describes, so the message can sit under that control. */
  failed: string | null
  /** Why it failed, when the screen should say more than the message. */
  failure: 'offline' | 'stale' | 'forbidden' | 'other' | null
  /** Sticky once the server refuses permission: controls are removed rather than left to fail. */
  forbidden: boolean
}


/**
 * Runs one control command at a time and refuses to send any while offline, so a command cannot
 * be duplicated by a second press or replayed later against a service that has moved on.
 */
export function useControls(refresh: (update?: SessionState | void) => void) {
  const [state, setState] = useState<ControlsState>({ running: null, error: null, online: true, failed: null, failure: null, forbidden: false })
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

  /** Resolves true only when the server accepted the command. */
  const run = useCallback(async (name: string, command: () => Promise<SessionState | void>): Promise<boolean> => {
    if (running.current) return false
    if (!online.current) { setState(current => ({ ...current, error: t('control.offline'), failed: name, failure: 'offline' })); return false }
    running.current = name
    setState(current => ({ ...current, running: name, error: null, failed: null, failure: null }))
    try {
      const update = await command()
      refresh(update)
      if (mounted.current) setState(current => ({ ...current, running: null }))
      return true
    } catch (failure) {
      // An ended sign-in is handled by the signed-in layout, which returns to the sign-in screen.
      // A refused stale move means this screen is behind, so pull the current state before the next command.
      if (isStalePart(failure)) refresh()
      const message = isUnauthorized(failure) ? null : failure instanceof Error ? failure.message : t('control.updateFailed')
      const kind = message === null ? null : isStalePart(failure) ? 'stale' : isControlForbidden(failure) ? 'forbidden' : 'other'
      if (mounted.current) setState(current => ({ ...current, running: null, error: message, failed: message === null ? null : name, failure: kind,
        forbidden: current.forbidden || kind === 'forbidden' }))
      return false
    } finally {
      running.current = null
    }
  }, [refresh])

  return { ...state, run }
}
