import { AppState } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network'
import type { Lifecycle } from './controller'
export const lifecycle: Lifecycle = {
  listen(callback) {
    let disposed = false, active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive', online = true, networkEvent = false
    const updateNetwork = (state: NetworkState) => {
      if (disposed) return
      online = state.isConnected !== false && state.isInternetReachable !== false
      callback(active, online)
    }
    const app = AppState.addEventListener('change', state => { active = state === 'active'; callback(active, online) })
    const network = addNetworkStateListener(state => { networkEvent = true; updateNetwork(state) })
    callback(active, online)
    void getNetworkStateAsync().then(state => { if (!networkEvent) updateNetwork(state) }, () => { /* Fetch remains the authority for reachability. */ })
    return () => { disposed = true; app.remove(); network.remove() }
  },
}
