import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'

export type KeepAwakeAppState = Pick<typeof AppState, 'currentState' | 'addEventListener'>

/** Keeps an attended reading screen awake, but never holds the display awake while the app is backgrounded. */
export function useScreenKeepAwake(tag: string, appState: KeepAwakeAppState = AppState): void {
  useEffect(() => {
    let awake = false
    const setAwake = (next: boolean) => {
      if (awake === next) return
      awake = next
      if (next) void activateKeepAwakeAsync(tag)
      else void deactivateKeepAwake(tag)
    }
    const change = (next: AppStateStatus) => setAwake(next === 'active')
    setAwake(appState.currentState === 'active')
    const subscription = appState.addEventListener('change', change)
    return () => {
      subscription.remove()
      setAwake(false)
    }
  }, [appState, tag])
}
