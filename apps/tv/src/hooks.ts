import { useEffect, useState } from 'react'
import { AppState, BackHandler, Platform, TVEventControl } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { lifecycle } from './reader'

/**
 * Menu goes back while there is somewhere to go. At the root the key is released, so Menu leaves
 * the app for the Apple TV home screen as tvOS users expect.
 */
export function useMenuBack(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return
    if (Platform.isTV) TVEventControl.enableTVMenuKey()
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => { subscription.remove(); if (Platform.isTV) TVEventControl.disableTVMenuKey() }
  }, [enabled, onBack])
}

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
