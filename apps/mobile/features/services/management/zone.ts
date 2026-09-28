import { useEffect, useState } from 'react'
import type { AuthContextValue } from '../../auth/AuthProvider'
import { fetchBootstrap } from './api'
import { todayIn } from './draft'

type Fetch = AuthContextValue['authorizedFetch']
/** The church's declared zone, read once per sign-in from the (read-only) management bootstrap. */
const zones = new WeakMap<Fetch, Promise<string | null>>()

function deviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/**
 * Today's calendar date in the backend's effective zone, for "today" consequences in the editor and the
 * delete confirmation, matching creation. Falls back to this device's zone only until (or if) the zone is unknown.
 */
export function useManagementToday(fetcher: Fetch): string {
  const [zone, setZone] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let pending = zones.get(fetcher)
    if (!pending) {
      pending = fetchBootstrap(fetcher, new AbortController().signal).then(bootstrap => bootstrap.timeZone, () => null)
      zones.set(fetcher, pending)
    }
    void pending.then(value => { if (active) setZone(value) })
    return () => { active = false }
  }, [fetcher])
  return todayIn(zone ?? deviceZone(), todayIn(deviceZone(), ''))
}
