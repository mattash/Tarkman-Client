import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { usePathname } from 'expo-router'
import { useAuth } from '../../auth/AuthProvider'
import { PresenceCoordinator, identityFor, type PresenceState } from './coordinator'

export function useControllerPresence(sessionId: number, api: string | undefined): PresenceState {
  const { state: auth, authorizedFetch, beforeSignOut } = useAuth()
  const pathname = usePathname()
  const [sample, setSample] = useState<{ auth: typeof auth; api: string; sessionId: number; routeGeneration: number; state: PresenceState } | null>(null)
  const route = pathname === `/services/${sessionId}` || pathname === `/services/${sessionId}/service` || pathname === `/services/${sessionId}/languages`
  const [routeLifetime, setRouteLifetime] = useState({ route: false, generation: 0 })
  if (route !== routeLifetime.route) {
    setRouteLifetime({ route, generation: routeLifetime.generation + Number(route) })
  }
  const routeGeneration = routeLifetime.generation + Number(route && !routeLifetime.route)
  useEffect(() => {
    if (auth.status !== 'signedIn' || !api || !Number.isSafeInteger(sessionId) || sessionId <= 0 || !route) {
      return
    }
    const coordinator = new PresenceCoordinator(authorizedFetch, sessionId, identityFor(auth, api), state => {
      setSample({ auth, api, sessionId, routeGeneration, state })
    })
    let visible = Platform.OS === 'web' ? typeof document !== 'undefined' && document.visibilityState === 'visible' : AppState.currentState === 'active'
    let online = false
    let disposed = false
    let networkEvent = false
    const reconcile = () => { if (visible && online) coordinator.start(); else coordinator.stop() }
    const app = Platform.OS === 'web' ? null : AppState.addEventListener('change', next => { visible = next === 'active'; reconcile() })
    const visibility = () => { visible = document.visibilityState === 'visible'; reconcile() }
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility)
    const network = addNetworkStateListener(next => {
      networkEvent = true
      online = next.isConnected === true && next.isInternetReachable === true
      reconcile()
    })
    void getNetworkStateAsync().then(next => {
      if (disposed || networkEvent) return
      online = next.isConnected === true && next.isInternetReachable === true
      reconcile()
    }, () => { /* Unknown reachability does not register a controller. */ })
    const unlisten = beforeSignOut(() => coordinator.stop())
    return () => {
      disposed = true
      unlisten()
      coordinator.stop()
      app?.remove(); network.remove()
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility)
    }
  }, [auth, api, sessionId, route, routeGeneration, authorizedFetch, beforeSignOut])
  // Mask in render, before effect teardown: old counts cannot cross any lifecycle boundary.
  return route && auth.status === 'signedIn' && api && sample?.auth === auth && sample.api === api &&
    sample.sessionId === sessionId && sample.routeGeneration === routeGeneration ? sample.state : { kind: 'unavailable' }
}
