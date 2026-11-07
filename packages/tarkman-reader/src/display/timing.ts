// Projection timing for the session display, shared by apps/mobile and apps/tv.
/** Match the API's default estimate when it cannot supply a valid duration. */
const FALLBACK_WORDS_PER_MINUTE = 160
export function projectionDuration(durationMs: number | null | undefined, texts: Array<string | null>): number {
  if (typeof durationMs === 'number' && Number.isSafeInteger(durationMs) && durationMs > 0) return durationMs
  const words = Math.max(0, ...texts.map(text => text?.trim().split(/\s+/).filter(Boolean).length ?? 0))
  return Math.max(3000, words * 60000 / FALLBACK_WORDS_PER_MINUTE)
}

export interface ProjectionClock {
  elapsed(): number
  running(): boolean
  setRunning(running: boolean): void
  subscribe(listener: () => void): () => void
}
/** One monotonic clock per occurrence, shared by translations and independent of layout. */
export function createProjectionClock(now = () => performance.now()): ProjectionClock {
  let accumulated = 0, started: number | null = null
  const listeners = new Set<() => void>()
  const elapsed = () => accumulated + (started === null ? 0 : Math.max(0, now() - started))
  return {
    elapsed, running: () => started !== null,
    setRunning(running) {
      if (running === (started !== null)) return
      accumulated = elapsed()
      started = running ? now() : null
      for (const listener of listeners) listener()
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

/** Linked continuous columns use the densest column's opening/final screenful reading time.
 * Fitting/unmeasured columns do not shorten that dwell. Once movement starts, keep the
 * interval for this occurrence: later reflow changes travel, not phase or completion time.
 */
export function createContinuousGroup() {
  const holds = new Map<string, number | null>(), listeners = new Set<(hold: number | undefined) => void>()
  let startedHold: number | undefined, startedDuration: number | undefined, expected = 1
  const get = () => {
    if (startedHold !== undefined) return startedHold
    if (holds.size < expected) return undefined
    const overflowing = [...holds.values()].filter((hold): hold is number => hold !== null)
    return overflowing.length ? Math.min(...overflowing) : 0
  }
  const publish = () => { const hold = get(); for (const listener of listeners) listener(hold) }
  return {
    get,
    expect(count: number) { expected = Math.max(1, count); publish() },
    duration(value: number) { return startedDuration ?? value },
    start(duration: number) {
      if (startedHold === undefined && get() !== undefined) { startedHold = get(); startedDuration = duration }
    },
    report(id: string, content: number, viewport: number) {
      if (viewport > 0) holds.set(id, content - viewport > 2 ? viewport / (2 * content) : null)
      else holds.delete(id)
      publish()
      return () => { holds.delete(id); publish() }
    },
    subscribe(listener: (hold: number | undefined) => void) { listeners.add(listener); listener(get()); return () => { listeners.delete(listener) } },
  }
}
export type ContinuousGroup = ReturnType<typeof createContinuousGroup>

interface ScrollGeometry { content: number; viewport: number; lineHeight: number; duration: number; reducedMotion: boolean; pageCount?: number; holdFraction?: number }
export function projectionPosition({ content, viewport, lineHeight, duration, reducedMotion, pageCount, holdFraction }: ScrollGeometry, elapsed: number) {
  const maximum = Math.max(0, content - viewport)
  if (maximum <= 2 || content <= 0 || viewport <= 0 || duration <= 0) return { y: 0, done: true, nextIn: 0 }
  const progress = Math.min(1, Math.max(0, elapsed / duration))
  const readingPosition = content * progress
  // Keep the estimated spoken line near the middle. Unlike the legacy calculation, this
  // reveals the final lines BEFORE the duration expires and gives both ends reading time.
  if (!reducedMotion) {
    if (holdFraction !== undefined) {
      const hold = Math.min(0.499, Math.max(0, holdFraction))
      const start = duration * hold, end = duration * (1 - hold)
      const movement = Math.min(1, Math.max(0, (elapsed - start) / (end - start)))
      return { y: maximum * movement, done: elapsed >= end, nextIn: Math.max(0, start - elapsed) }
    }
    const y = Math.min(maximum, Math.max(0, readingPosition - viewport / 2))
    return { y, done: y >= maximum, nextIn: Math.max(0, viewport / 2 / content * duration - elapsed) }
  }
  if (pageCount && pageCount > 1) {
    const page = Math.min(pageCount - 1, Math.floor(progress * pageCount))
    return { y: maximum * page / (pageCount - 1), done: page === pageCount - 1,
      nextIn: Math.max(1, (page + 1) * duration / pageCount - elapsed) }
  }
  // Reduced motion uses discrete pages with up to two lines of overlap, on the same clock.
  const step = Math.max(1, viewport - Math.min(lineHeight * 2, viewport / 2))
  const page = Math.floor(readingPosition / step)
  const y = Math.min(maximum, page * step)
  return { y, done: y >= maximum, nextIn: Math.max(1, (page + 1) * step / content * duration - elapsed) }
}

interface Scheduler {
  frame(callback: () => void): number
  cancelFrame(id: number): void
  timer(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  cancelTimer(id: ReturnType<typeof setTimeout>): void
}
const scheduler: Scheduler = {
  frame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
  timer: (callback, delay) => setTimeout(callback, delay), cancelTimer: id => clearTimeout(id),
}
/** No frame-count timing, overlapping animation chains, or repeated scrolling after the end. */
export function startProjectionScroll(clock: ProjectionClock, geometry: ScrollGeometry, scrollTo: (y: number) => void, schedule = scheduler): () => void {
  let frame: number | null = null, timer: ReturnType<typeof setTimeout> | null = null, disposed = false, previous: number | null = null
  const cancel = () => {
    if (frame !== null) schedule.cancelFrame(frame)
    if (timer !== null) schedule.cancelTimer(timer)
    frame = null; timer = null
  }
  const update = () => {
    cancel()
    if (disposed) return
    const position = projectionPosition(geometry, clock.elapsed())
    if (position.y !== previous) { scrollTo(position.y); previous = position.y }
    if (!clock.running() || position.done) return
    if (position.nextIn > 0) timer = schedule.timer(update, Math.min(position.nextIn, 2147483647))
    else frame = schedule.frame(update)
  }
  const unsubscribe = clock.subscribe(update)
  update()
  return () => { disposed = true; cancel(); unsubscribe() }
}
