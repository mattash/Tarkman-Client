import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { usePathname } from 'expo-router'
import { useAuth } from '../../auth/AuthProvider'
import { PresenceCoordinator, identityFor, type PresenceState } from './coordinator'

export function useControllerPresence(sessionId: number, api: string | undefined): PresenceState {
  const { state: auth, authorizedFetch, beforeSignOut } = useAuth()
  const pathname = usePathname()
  const [state, setState] = useState<PresenceState>({ kind: 'unavailable' })
  const route = pathname === `/services/${sessionId}` || pathname === `/services/${sessionId}/service` || pathname === `/services/${sessionId}/languages`
  useEffect(() => {
    if (auth.status !== 'signedIn' || !api || !Number.isSafeInteger(sessionId) || sessionId <= 0 || !route) {
      return
    }
    const coordinator = new PresenceCoordinator(authorizedFetch, sessionId, identityFor(auth, api), setState)
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
  }, [auth, api, sessionId, route, authorizedFetch, beforeSignOut])
  return route && auth.status === 'signedIn' ? state : { kind: 'unavailable' }
}
