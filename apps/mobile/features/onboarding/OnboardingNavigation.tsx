import { useEffect, useRef } from 'react'
import { usePathname } from 'expo-router'
import { useOnboarding } from './OnboardingProvider'

/** Selection intent survives only the explicit help -> Today -> chosen reader route. */
export function OnboardingNavigation() {
  const path = usePathname(), previous = useRef(path)
  const { pending, clearPending } = useOnboarding()
  useEffect(() => {
    const changed = previous.current !== path
    previous.current = path
    if (!pending || !changed) return
    if (path === '/' || pending.sessionId !== null && path === `/sessions/${pending.sessionId}/parts`) return
    clearPending()
  }, [path, pending, clearPending])
  return null
}
