import { useEffect, useMemo, useState } from 'react'
import { AppState, BackHandler, Platform, TVEventControl } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { createProjectionClock } from '@tarkman/reader'
import { lifecycle } from './reader'

/**
 * Menu goes back while there is somewhere to go. At the root the key is released, so Menu leaves
 * the app for the Apple TV home screen as tvOS users expect.
 */
export function useMenuBack(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return
    retainMenuKey()
    // The most recent listener runs first, so an open overlay closes before the screen goes back.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => { subscription.remove(); releaseMenuKey() }
  }, [enabled, onBack])
}

// Several listeners can want Menu at once (a screen and its overlay); release it only when none do.
let menuHolders = 0
function retainMenuKey() { if (menuHolders++ === 0 && Platform.isTV) TVEventControl.enableTVMenuKey() }
function releaseMenuKey() { if (--menuHolders === 0 && Platform.isTV) TVEventControl.disableTVMenuKey() }

/** Reachability from the same lifecycle the engine uses, so the badge and the engine agree. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => lifecycle.listen((_active, next) => setOnline(next)), [])
  return online
}

/** Keep the screen on only while this view is foregrounded and asks for it; never in the background. */
export function useKeepAwakeWhile(wanted: boolean, tag: string) {
  const [foreground, setForeground] = useState(AppState.currentState !== 'background')
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'))
    return () => subscription.remove()
  }, [])
  const on = wanted && foreground
  useEffect(() => {
    if (!on) return
    void activateKeepAwakeAsync(tag).catch(() => {})
    return () => { void deactivateKeepAwake(tag).catch(() => {}) }
  }, [on, tag])
}

/** apps/mobile's useProjectionClock: one clock per occurrence, paused whenever the app is not active. */
export function useProjectionClock(occurrence: string, running: boolean) {
  // The key is an occurrence, never the poll revision, language, text measurement or viewport.
  const clock = useMemo(() => ({ occurrence, ...createProjectionClock() }), [occurrence])
  useEffect(() => {
    const update = (state: string | null) => clock.setRunning(running && state !== 'background' && state !== 'inactive')
    update(AppState.currentState)
    const subscription = AppState.addEventListener('change', update)
    return () => { subscription?.remove(); clock.setRunning(false) }
  }, [clock, running])
  return clock
}
