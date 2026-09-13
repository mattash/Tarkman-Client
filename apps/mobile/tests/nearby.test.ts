import { expect, it } from '@jest/globals'
import { metresBetween, nearestService, NEARBY_RADIUS_METRES } from '../features/nearby/distance'
import { normalizeServices } from '../features/live/contracts'

const stJohn = { latitude: 37.7509, longitude: -122.4477 }

function service(id: number, church: string, latitude: number | null, longitude: number | null) {
  return { session: { id, church_name: church, liturgy: 'Divine Liturgy', church_latitude: latitude, church_longitude: longitude } }
}

it('measures real distances closely enough to tell buildings apart', () => {
  expect(metresBetween(stJohn, stJohn)).toBe(0)
  // Roughly one degree of latitude is 111km.
  expect(metresBetween(stJohn, { ...stJohn, latitude: stJohn.latitude + 1 })).toBeGreaterThan(110_000)
  expect(metresBetween(stJohn, { ...stJohn, latitude: stJohn.latitude + 1 })).toBeLessThan(112_000)
  // About 100m north.
  const hundredMetres = metresBetween(stJohn, { ...stJohn, latitude: stJohn.latitude + 0.0009 })
  expect(hundredMetres).toBeGreaterThan(90)
  expect(hundredMetres).toBeLessThan(110)
})

it('offers the church you are standing in', () => {
  const services = normalizeServices({ sessions: [service(9, 'St. John', stJohn.latitude, stJohn.longitude)] })
  const found = nearestService(services, { latitude: stJohn.latitude + 0.0002, longitude: stJohn.longitude })
  expect(found?.session.id).toBe(9)
  expect(found?.metres).toBeLessThan(NEARBY_RADIUS_METRES)
})

it('offers nothing when the nearest church is across town', () => {
  const services = normalizeServices({ sessions: [service(9, 'St. John', stJohn.latitude, stJohn.longitude)] })
  expect(nearestService(services, { latitude: 37.8, longitude: -122.4 })).toBeNull()
})

it('picks the nearer of two churches in range', () => {
  const services = normalizeServices({ sessions: [
    service(9, 'St. John', stJohn.latitude, stJohn.longitude),
    service(10, 'Nearer', stJohn.latitude + 0.0002, stJohn.longitude),
  ] })
  expect(nearestService(services, { latitude: stJohn.latitude + 0.0002, longitude: stJohn.longitude })?.session.id).toBe(10)
})

it('ignores churches the API has not geocoded, and nonsense coordinates', () => {
  const services = normalizeServices({ sessions: [
    service(9, 'No coordinates', null, null),
    service(11, 'Out of range values', 999, -122.4477),
    service(12, 'Latitude past the pole', 122.4477, -122.4477),
  ] })
  expect(services.map(session => session.latitude)).toEqual([null, null, null])
  expect(nearestService(services, stJohn)).toBeNull()
})

it('reads coordinates sent as numbers or strings', () => {
  const [session] = normalizeServices({ sessions: [service(9, 'St. John', 37.7509, -122.4477)] })
  expect(session.latitude).toBeCloseTo(37.7509)
  const [asString] = normalizeServices({ sessions: [{ session: { id: 9, church_latitude: '37.7509', church_longitude: '-122.4477' } }] })
  expect(asString.latitude).toBeCloseTo(37.7509)
})
