import { expect, it } from '@jest/globals'
import { createContinuousGroup, createProjectionClock, projectionDuration, projectionPosition, startProjectionScroll } from '../features/displayLinks/projectionTiming'

const base = { viewport: 600, lineHeight: 60, duration: 60000, reducedMotion: false }

it('replaces the 42s/51s endpoint gap with shared opening and final dwell, regardless of sides', () => {
  for (const contents of [[1000, 2000], [2000, 1000]]) {
    const group = createContinuousGroup()
    contents.forEach((content, index) => group.report(String(index), content, base.viewport))
    const holdFraction = group.get()
    expect(holdFraction).toBe(0.15)
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
    const stops = contents.map((content, index) => startProjectionScroll(clock, { ...base, content, holdFraction }, y => {
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
      pair.forEach(([content, viewport], i) => group.report(String(i), content, viewport))
      const holdFraction = group.get()!
      for (const [content, viewport] of pair) {
        const geometry = { ...base, duration, content, viewport, holdFraction }
        const start = duration * holdFraction, end = duration * (1 - holdFraction)
        expect(projectionPosition(geometry, start).y).toBe(0)
        expect(projectionPosition(geometry, end - 1).done).toBe(false)
        expect(projectionPosition(geometry, end)).toMatchObject({ y: content - viewport, done: true })
        expect(projectionPosition(geometry, duration * 2).y).toBe(content - viewport)
      }
    }
  }
})

it('ignores fitting/unmeasured columns and publishes geometry updates without changing the clock phase', () => {
  const group = createContinuousGroup()
  const holds: Array<number | undefined> = []
  const unsubscribe = group.subscribe(value => holds.push(value))
  const removeShort = group.report('short', 1000, 600)
  const removeLong = group.report('long', 2000, 600)
  group.report('fitting', 600, 600)
  group.report('unmeasured', 1000, 0)
  expect(group.get()).toBe(0.15)
  removeLong()
  expect(group.get()).toBe(0.3)
  group.report('short', 3000, 600)
  expect(group.get()).toBe(0.1)
  const geometry = { ...base, content: 3000, holdFraction: group.get() }
  expect(projectionPosition(geometry, 30000).y).toBe(1200)
  expect(projectionPosition(geometry, 60000)).toMatchObject({ y: 2400, done: true })
  for (const content of [0, 300, 602]) expect(projectionPosition({ ...geometry, content }, 30000)).toMatchObject({ y: 0, done: true })
  removeShort()
  expect(group.get()).toBe(0)
  expect(holds.at(-1)).toBe(0)
  unsubscribe()
})

it('waits for both measurements and retains the started interval across reflow, remount and duration refresh', () => {
  const group = createContinuousGroup()
  group.expect(2)
  const removeShort = group.report('short', 1000, 600)
  expect(group.get()).toBeUndefined()
  group.start(60000) // A late mount cannot freeze an incomplete geometry set.
  const removeLong = group.report('long', 2000, 600)
  expect(group.get()).toBe(0.15)
  group.start(60000)
  removeLong()
  group.report('long', 6000, 600)
  expect(group.get()).toBe(0.15)
  expect(group.duration(90000)).toBe(60000)
  const geometry = { ...base, content: 1000, holdFraction: group.get(), duration: group.duration(90000) }
  expect(projectionPosition(geometry, 30000).y).toBe(200)
  expect(projectionPosition(geometry, 52000)).toMatchObject({ y: 400, done: true })
  removeShort()
  group.report('short', 3000, 600)
  expect(projectionPosition({ ...geometry, content: 3000 }, 52000)).toMatchObject({ y: 2400, done: true })
  group.expect(1)
  expect(group.get()).toBe(0.15)
})

it('leaves independent continuous and linked reduced-motion page positions unchanged', () => {
  expect(projectionPosition({ ...base, content: 1000 }, 42000)).toMatchObject({ y: 400, done: true })
  expect(projectionPosition({ ...base, content: 2000 }, 42000).done).toBe(false)
  for (const elapsed of [0, 10000, 30000, 51000, 60000]) {
    const geometry = { ...base, content: 2000, reducedMotion: true, pageCount: 5 }
    expect(projectionPosition({ ...geometry, holdFraction: 0.15 }, elapsed)).toEqual(projectionPosition(geometry, elapsed))
  }
})
