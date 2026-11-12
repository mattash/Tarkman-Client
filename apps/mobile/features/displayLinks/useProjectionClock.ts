import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'
import { createProjectionClock } from './projectionTiming'

export function useProjectionClock(occurrence: string, running: boolean) {
  // The key is an occurrence, never the poll revision, language, text measurement or viewport.
  const clock = useMemo(() => ({ occurrence, ...createProjectionClock() }), [occurrence])
  useEffect(() => {
    const update = (state: string | null | undefined) => clock.setRunning(running && state !== 'background' && state !== 'inactive')
    update(AppState.currentState)
    const subscription = AppState.addEventListener('change', update)
    return () => { subscription?.remove(); clock.setRunning(false) }
  }, [clock, running])
  return clock
}
