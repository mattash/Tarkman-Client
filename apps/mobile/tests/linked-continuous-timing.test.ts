import { expect, it } from '@jest/globals'
import { createContinuousGroup, createProjectionClock, projectionDuration, projectionPosition, startProjectionScroll } from '../features/displayLinks/projectionTiming'

const base = { viewport: 600, lineHeight: 60, duration: 60000, reducedMotion: false }

it('replaces the 42s/51s endpoint gap with shared opening and final dwell, regardless of sides', () => {
  for (const contents of [[1000, 2000], [2000, 1000]]) {
    const group = createContinuousGroup()
    contents.forEach((content, index) => group.setGeometry(String(index), content, base.viewport))
    let now = 0, serial = 0
    const callbacks = new Map<number, { at: number; callback: () => void }>()
    const schedule = {
      frame(callback: () => void) { const id = ++serial; callbacks.set(id, { at: now + 10, callback }); return id },
      cancelFrame(id: number) { callbacks.delete(id) },
      timer(callback: () => void, delay: number) { const id = ++serial; callbacks.set(id, { at: now + delay, callback }); return id as unknown as ReturnType<typeof setTimeout> },
      cancelTimer(id: ReturnType<typeof setTimeout>) { callbacks.delete(id as unknown as number) },
    }
    const clock = createProjectionClock(() => now)
    clock.setRunning(true)
    const endpoints: number[] = [], openings: number[] = [], middle: number[] = []
    const stops = contents.map((content, index) => startProjectionScroll(clock, { ...base, content, continuousGroup: group }, y => {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(content - base.viewport)
      if (y > 0 && openings[index] === undefined) openings[index] = now
      if (now === 30000) middle[index] = y
      if (y === content - base.viewport) endpoints[index] = now
    }, schedule))
    for (now = 10; now <= 60000; now += 10) {
      for (const [id, { at, callback }] of [...callbacks]) if (at <= now) { callbacks.delete(id); callback() }
    }
    expect(openings).toEqual([9010, 9010])
    expect(endpoints).toEqual([51000, 51000])
    expect(middle).toEqual(contents.map(content => (content - base.viewport) / 2))
    expect(callbacks.size).toBe(0)
    stops.forEach(stop => stop())
  }
})

it('keeps paired boundaries across duration sources, viewport sizes, font reflow and stacked geometry', () => {
  const texts = [Array(80).fill('word').join(' '), Array(160).fill('word').join(' ')]
  for (const duration of [projectionDuration(25000, texts), ...[null, 0, NaN].map(value => projectionDuration(value, texts))]) {
    for (const pair of [[[1000, 600], [2000, 600]], [[3000, 900], [6000, 900]], [[900, 300], [2400, 280]], [[3600, 450], [7200, 450]]]) {
      const group = createContinuousGroup()
      pair.forEach(([content, viewport], i) => group.setGeometry(String(i), content, viewport))
      const hold = Math.min(...pair.map(([content, viewport]) => viewport / (2 * content)))
      expect(group.position(duration * hold, duration)?.progress).toBe(0)
      expect(group.position(duration * (1 - hold) - 1, duration)?.done).toBe(false)
      expect(group.position(duration * (1 - hold), duration)).toMatchObject({ progress: 1, done: true })
      expect(group.position(duration * 2, duration)?.progress).toBe(1)
    }
  }
})

it('retimes both moving columns without a jump when the API corrects duration from 30s to 90s', () => {
  const group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 2000, 600)
  expect(group.position(15000, 30000)?.progress).toBe(0.5)
  expect(group.position(15000, 90000)?.progress).toBe(0.5)
  expect(group.position(45750, 90000)?.progress).toBeCloseTo(0.75)
  expect(group.position(76500, 90000)).toMatchObject({ progress: 1, done: true })
  group.setGeometry('long', 6000, 600)
  expect(group.position(80000, 120000)).toMatchObject({ progress: 1, done: true })
})

it('completes immediately rather than rewinding when a corrected endpoint is already past', () => {
  const group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 2000, 600)
  expect(group.position(30000, 60000)?.progress).toBe(0.5)
  expect(group.position(30000, 30000)).toMatchObject({ progress: 1, done: true })
  for (const content of [1000, 2000]) {
    expect(projectionPosition({ ...base, content, duration: 30000, continuousGroup: group }, 30000))
      .toMatchObject({ y: content - base.viewport, done: true })
  }
  expect(group.position(30000, 90000)).toMatchObject({ progress: 1, done: true })
})

it('publishes only changed opening geometry and never resets a started phase', () => {
  const group = createContinuousGroup()
  let notifications = 0
  const unsubscribe = group.subscribe(() => { notifications++ })
  group.setGeometry('short', 1000, 600)
  group.setGeometry('short', 1000, 600)
  expect(notifications).toBe(1)
  group.setGeometry('long', 2000, 600)
  group.setGeometry('long', 2000, 600)
  expect(notifications).toBe(2)
  expect(group.position(30000, 60000)?.progress).toBe(0.5)
  group.setGeometry('long', 6000, 600)
  expect(group.position(30000, 60000)?.progress).toBe(0.5)
  expect(notifications).toBe(2)
  unsubscribe()
})

it('pauses and resumes both schedulers on the same live group phase', () => {
  let now = 0, serial = 0
  const callbacks = new Map<number, { at: number; callback: () => void }>()
  const schedule = {
    frame(callback: () => void) { const id = ++serial; callbacks.set(id, { at: now + 10, callback }); return id },
    cancelFrame(id: number) { callbacks.delete(id) },
    timer(callback: () => void, delay: number) { const id = ++serial; callbacks.set(id, { at: now + delay, callback }); return id as unknown as ReturnType<typeof setTimeout> },
    cancelTimer(id: ReturnType<typeof setTimeout>) { callbacks.delete(id as unknown as number) },
  }
  const advance = (time: number) => {
    now = time
    for (const [id, { at, callback }] of [...callbacks]) if (at <= now) { callbacks.delete(id); callback() }
  }
  const clock = createProjectionClock(() => now), group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 2000, 600)
  const positions = [0, 0]
  clock.setRunning(true)
  const stops = [1000, 2000].map((content, index) => startProjectionScroll(clock,
    { ...base, content, continuousGroup: group }, y => { positions[index] = y }, schedule))
  advance(20000)
  clock.setRunning(false)
  const paused = [...positions]
  expect(callbacks.size).toBe(0)
  advance(50000)
  expect(positions).toEqual(paused)
  expect(clock.elapsed()).toBe(20000)
  clock.setRunning(true)
  advance(60000)
  expect(positions).toEqual([200, 700])
  stops.forEach(stop => stop())
  expect(callbacks.size).toBe(0)
})

it('uses fresh opening geometry rather than freezing movement from the previous hold', () => {
  const group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 3000, 600)
  expect(group.position(0, 60000)?.progress).toBe(0)
  // No frame ran between zero and the resize: the old 6s hold must not start movement.
  group.setGeometry('long', 2000, 600)
  expect(group.position(7000, 60000)?.progress).toBe(0)
  group.setGeometry('long', 1500, 600)
  expect(group.position(10000, 60000)?.progress).toBe(0)
  expect(group.position(12000, 60000)?.progress).toBe(0)
  expect(group.position(13000, 60000)?.progress).toBeGreaterThan(0)
})

it('uses a bounded 250ms measurement wait and accepts dense geometry reported inside it', () => {
  const fallback = createContinuousGroup()
  fallback.setGeometry('short', 1000, 600)
  expect(fallback.position(30000, 60000)).toMatchObject({ progress: 0, done: false, nextIn: 250 })
  expect(fallback.position(30249, 60000)).toMatchObject({ progress: 0, done: false, nextIn: 1 })
  expect(fallback.position(30250, 60000)?.progress).toBeGreaterThan(0)
  const late = createContinuousGroup()
  late.setGeometry('short', 1000, 600)
  expect(late.position(30000, 60000)?.progress).toBe(0)
  late.setGeometry('long', 2000, 600)
  expect(late.position(30100, 60000)?.progress).toBeCloseTo((30100 - 9000) / 42000)
})

it('removes stale geometry without rewinding a started phase', () => {
  const group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 2000, 600)
  expect(group.position(30000, 60000)?.progress).toBe(0.5)
  group.remove('long')
  group.setGeometry('long', 6000, 600)
  expect(group.position(30000, 60000)?.progress).toBe(0.5)
  expect(group.position(51000, 60000)).toMatchObject({ progress: 1, done: true })
})

it('leaves independent continuous and reduced-motion page positions unchanged', () => {
  expect(projectionPosition({ ...base, content: 1000 }, 42000)).toMatchObject({ y: 400, done: true })
  expect(projectionPosition({ ...base, content: 2000 }, 42000).done).toBe(false)
  const group = createContinuousGroup()
  group.setGeometry('short', 1000, 600); group.setGeometry('long', 2000, 600)
  for (const elapsed of [0, 10000, 30000, 51000, 60000]) {
    const geometry = { ...base, content: 2000, reducedMotion: true, pageCount: 5 }
    expect(projectionPosition({ ...geometry, continuousGroup: group }, elapsed)).toEqual(projectionPosition(geometry, elapsed))
  }
})
