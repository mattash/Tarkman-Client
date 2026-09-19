import { expect, it } from '@jest/globals'
import { createProjectionClock, projectionDuration, projectionPosition, startProjectionScroll } from '../features/displayLinks/projectionTiming'
import { normalizeParts } from '../features/live/contracts'
import { buildSavedService, validateSavedService } from '../features/offline/savedService'

const geometry = { content: 1000, viewport: 400, lineHeight: 40, duration: 10000, reducedMotion: false }

it('holds the opening, follows estimated reading progress, then leaves time for the last lines', () => {
  expect([0, 1000, 2000, 3000, 5000, 8000, 10000, 60000].map(elapsed => projectionPosition(geometry, elapsed).y))
    .toEqual([0, 0, 0, 100, 300, 600, 600, 600])
  expect(projectionPosition(geometry, 8000).done).toBe(true)
})
it('keeps the same estimated reading position across different language lengths and resized viewports', () => {
  for (const [content, viewport] of [[1000, 400], [1800, 400], [2000, 500]]) {
    const { y } = projectionPosition({ ...geometry, content, viewport }, 5000)
    expect((y + viewport / 2) / content).toBe(0.5)
  }
})
it('does not scroll text that fits, including the measurement tolerance', () => {
  for (const content of [0, 200, 400, 402]) expect(projectionPosition({ ...geometry, content }, 5000)).toMatchObject({ y: 0, done: true })
  expect(projectionPosition({ ...geometry, viewport: 0 }, 5000).done).toBe(true)
})
it('uses timed overlapping pages for reduced motion and holds the final screen', () => {
  const reduced = { ...geometry, reducedMotion: true }
  expect([0, 3100, 3200, 6300, 6400, 20000].map(elapsed => projectionPosition(reduced, elapsed).y))
    .toEqual([0, 0, 320, 320, 600, 600])
  expect(projectionPosition(reduced, 0).nextIn).toBe(3200)
})
it('honors published durations and estimates missing timing from the longest selected translation', () => {
  const texts = [Array(160).fill('word').join(' '), Array(80).fill('word').join(' '), null]
  expect(projectionDuration(25000, texts)).toBe(25000)
  for (const invalid of [undefined, null, 0, -1, Infinity, NaN, 1.5]) expect(projectionDuration(invalid, texts)).toBe(60000)
  expect(projectionDuration(null, [null, '   '])).toBe(3000)
})
it('carries valid durations through the API and saved-service boundary without invalidating older saves', () => {
  for (const duration of [60000, 0, -1, '60000', null, undefined, Infinity, 1.5]) {
    const parts = normalizeParts({ parts: [{ part: { id: 1, effective_duration_ms: duration } }] })
    const expected = duration === 60000 ? 60000 : null
    expect(parts[0].effectiveDurationMs).toBe(expected)
    const saved = buildSavedService({ session: { id: 1, title: 'Prayer', church: 'Parish', date: null }, parts }, 1000)!
    expect(validateSavedService(saved, 1000)?.parts[0].effectiveDurationMs).toBe(expected)
    delete saved.parts[0].effectiveDurationMs
    expect(validateSavedService(saved, 1000)?.parts[0].effectiveDurationMs).toBeUndefined()
  }
})

function harness(reducedMotion = false) {
  let now = 0, serial = 0
  const frames = new Map<number, () => void>()
  const timers = new Map<number, { callback: () => void; at: number }>()
  const positions: number[] = []
  const clock = createProjectionClock(() => now)
  const schedule = {
    frame(callback: () => void) { const id = ++serial; frames.set(id, callback); return id },
    cancelFrame(id: number) { frames.delete(id) },
    timer(callback: () => void, delay: number) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id as unknown as ReturnType<typeof setTimeout> },
    cancelTimer(id: ReturnType<typeof setTimeout>) { timers.delete(id as unknown as number) },
  }
  clock.setRunning(true)
  const stop = startProjectionScroll(clock, { ...geometry, reducedMotion }, y => positions.push(y), schedule)
  const advance = (time: number) => {
    now = time
    for (const [id, callback] of [...frames]) { frames.delete(id); callback() }
    for (const [id, { callback, at }] of [...timers]) if (at <= now) { timers.delete(id); callback() }
  }
  return { clock, frames, timers, positions, stop, advance, schedule }
}
it('uses elapsed time after a delayed frame, cancels on pause, and resumes without counting the interruption', () => {
  const h = harness()
  expect(h.frames.size).toBe(0)
  expect([...h.timers.values()][0].at).toBe(2000)
  h.advance(5000)
  expect(h.positions.at(-1)).toBe(300)
  h.clock.setRunning(false)
  expect(h.frames.size).toBe(0)
  h.advance(15000)
  expect(h.clock.elapsed()).toBe(5000)
  h.clock.setRunning(true)
  h.advance(16000)
  expect(h.positions.at(-1)).toBe(400)
  h.advance(18000)
  expect(h.positions.at(-1)).toBe(600)
  expect(h.frames.size).toBe(0)
  h.advance(60000)
  expect(h.positions.at(-1)).toBe(600)
  h.stop()
})
it('remeasures the same running occurrence without restarting its clock', () => {
  const h = harness()
  h.advance(5000); h.stop()
  const stop = startProjectionScroll(h.clock, { ...geometry, content: 2000, viewport: 500 }, y => h.positions.push(y), h.schedule)
  expect(h.positions.at(-1)).toBe(750)
  stop()
  expect(h.frames.size).toBe(0)
})
it('schedules only page boundaries for reduced motion and clears both pending and already queued work on disposal', () => {
  const h = harness(true)
  expect(h.frames.size).toBe(0)
  expect(h.timers.size).toBe(1)
  h.advance(3200)
  expect(h.positions.at(-1)).toBe(320)
  const queued = [...h.timers.values()][0].callback
  h.stop()
  expect(h.timers.size).toBe(0)
  queued()
  h.clock.setRunning(false); h.clock.setRunning(true)
  expect(h.positions).toEqual([0, 320])
  expect(h.timers.size).toBe(0)
})
