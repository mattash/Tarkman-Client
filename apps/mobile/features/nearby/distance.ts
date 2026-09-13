import type { LiveSession } from '../live/contracts'

export interface Coordinates { latitude: number; longitude: number }

/** A church building is tens of metres across; this leaves room for a car park and poor GPS. */
export const NEARBY_RADIUS_METRES = 250

const EARTH_RADIUS_METRES = 6_371_000
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export function metresBetween(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)))
}

export interface NearbyService { session: LiveSession; metres: number }

/**
 * The nearest service whose church is within range, matched here on the device so a reader's
 * position never leaves the phone. Services without published coordinates cannot match.
 */
export function nearestService(services: LiveSession[], here: Coordinates, radius = NEARBY_RADIUS_METRES): NearbyService | null {
  let nearest: NearbyService | null = null
  for (const session of services) {
    if (session.latitude === null || session.longitude === null) continue
    const metres = metresBetween(here, { latitude: session.latitude, longitude: session.longitude })
    if (metres > radius) continue
    if (!nearest || metres < nearest.metres) nearest = { session, metres }
  }
  return nearest
}
