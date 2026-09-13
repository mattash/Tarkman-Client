import { useCallback, useRef, useState } from 'react'
import * as Location from 'expo-location'
import type { LiveSession } from '../live/contracts'
import { nearestService, type NearbyService } from './distance'

export type NearbyState =
  | { status: 'idle' }
  | { status: 'looking' }
  | { status: 'found'; nearby: NearbyService }
  | { status: 'none' }
  | { status: 'refused'; canAskAgain: boolean }
  | { status: 'unavailable' }

/**
 * Reads this device's position once, on request, and matches it against the churches already
 * listed. The position is used here and discarded: it is never stored and never sent to the API.
 */
export function useNearbyChurch(services: LiveSession[]) {
  const [state, setState] = useState<NearbyState>({ status: 'idle' })
  const looking = useRef(false)

  const find = useCallback(async () => {
    if (looking.current) return
    looking.current = true
    setState({ status: 'looking' })
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setState({ status: 'refused', canAskAgain: permission.canAskAgain })
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const nearby = nearestService(services, { latitude: position.coords.latitude, longitude: position.coords.longitude })
      setState(nearby ? { status: 'found', nearby } : { status: 'none' })
    } catch {
      // A position can be unavailable indoors or with location services off; reading still works.
      setState({ status: 'unavailable' })
    } finally {
      looking.current = false
    }
  }, [services])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, find, reset }
}
