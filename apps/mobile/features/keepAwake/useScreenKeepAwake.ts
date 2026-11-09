import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'

export type KeepAwakeAppState = Pick<typeof AppState, 'currentState' | 'addEventListener'>

let nextAcquisitionId = 0

/** Keeps an attended reading screen awake, but never holds the display awake while the app is backgrounded. */
export function useScreenKeepAwake(tag: string, appState: KeepAwakeAppState = AppState): void {
  useEffect(() => {
    let wantsAwake = false
    let acquisition: { tag: string; acquired: boolean } | undefined
    const release = async (lockTag: string) => {
      try {
        await deactivateKeepAwake(lockTag)
      } catch {
        // Cleanup is best effort too: browsers may already have released the lock.
      }
    }
    const setAwake = (next: boolean) => {
      if (wantsAwake === next) return
      wantsAwake = next
      const previous = acquisition
      acquisition = undefined
      if (previous?.acquired) {
        void release(previous.tag)
      }
      if (!next) return

      // Each request owns its tag so late cleanup cannot release a newer visit's lock.
      const request = { tag: `${tag}:${++nextAcquisitionId}`, acquired: false }
      acquisition = request
      void (async () => {
        try {
          await activateKeepAwakeAsync(request.tag)
          request.acquired = true
          if (acquisition !== request) {
            await release(request.tag)
          }
        } catch {
          // Browser wake locks are best effort (HTTPS, permission and device support).
        }
      })()
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
