import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Reads this device's position and matches it against the churches already listed. The position
 * is used here and discarded: it is never stored and never sent to the API.
 *
 * `find` is the reader's explicit request and may show the permission prompt. `check` never
 * prompts: it only looks when permission was already given, so Today can place a returning reader.
 */
export function useNearbyChurch(services: LiveSession[]) {
  const [state, setState] = useState<NearbyState>({ status: 'idle' })
  const looking = useRef(false)
  // Read at lookup time, so `check` and `find` stay stable while the services list polls.
  const listed = useRef(services)
  useEffect(() => { listed.current = services }, [services])

  const locate = useCallback(async (ask: boolean) => {
    if (looking.current) return
    looking.current = true
    try {
      const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync()
      if (!permission.granted) {
        // A quiet check leaves an undecided reader alone; only a refusal they made is shown.
        if (ask || !permission.canAskAgain) setState({ status: 'refused', canAskAgain: permission.canAskAgain })
        return
      }
      setState(current => current.status === 'found' ? current : { status: 'looking' })
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const nearby = nearestService(listed.current, { latitude: position.coords.latitude, longitude: position.coords.longitude })
      setState(nearby ? { status: 'found', nearby } : { status: 'none' })
    } catch {
      // A position can be unavailable indoors or with location services off; reading still works.
      setState({ status: 'unavailable' })
    } finally {
      looking.current = false
    }
  }, [])

  const find = useCallback(() => locate(true), [locate])
  const check = useCallback(() => locate(false), [locate])
  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, find, check, reset }
}
