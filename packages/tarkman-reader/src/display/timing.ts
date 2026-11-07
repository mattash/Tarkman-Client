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

/** A pair's clock-derived phase, independent of React renders and scroll commands.
 * Geometry settles for at most 250ms of active reading time if a peer never measures.
 * Reflow preserves the started hold; corrected API durations preserve the current
 * fraction and re-time the remaining movement to the corrected completion boundary.
 */
export function createContinuousGroup(expected = 2) {
  const holds = new Map<string, number | null>(), listeners = new Set<() => void>()
  let waitingSince: number | undefined, published = ''
  let movement: { hold: number; duration: number; fromElapsed: number; fromProgress: number; end: number } | undefined
  const hold = () => {
    let value = 0.5, overflowing = false
    for (const current of holds.values()) if (current !== null) { value = Math.min(value, current); overflowing = true }
    return overflowing ? value : 0
  }
  const publish = () => {
    // Once moving, geometry changes travel only. No React-wide notifications per reflow.
    if (movement) return
    const value = `${holds.size}:${hold()}`
    if (value === published) return
    published = value
    for (const listener of listeners) listener()
  }
  const progressAt = (elapsed: number) => {
    if (!movement) return 0
    if (elapsed >= movement.end) return 1
    return movement.fromProgress + (1 - movement.fromProgress) * Math.max(0, elapsed - movement.fromElapsed) / (movement.end - movement.fromElapsed)
  }
  return {
    setGeometry(id: string, content: number, viewport: number) {
      if (viewport > 0) holds.set(id, content - viewport > 2 ? viewport / (2 * content) : null)
      else holds.delete(id)
      publish()
    },
    remove(id: string) { holds.delete(id); publish() },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    position(elapsed: number, duration: number) {
      if (!movement) {
        if (holds.size === 0) return undefined
        if (holds.size < expected) {
          waitingSince ??= elapsed
          if (elapsed - waitingSince < 250) return { progress: 0, done: false, nextIn: 250 - (elapsed - waitingSince) }
        }
        const fraction = hold(), start = duration * fraction, end = duration * (1 - fraction)
        if (elapsed <= start) return { progress: 0, done: false, nextIn: start - elapsed }
        movement = { hold: fraction, duration, fromElapsed: start, fromProgress: 0, end }
      } else if (duration !== movement.duration) {
        // Apply authoritative corrections without a backwards jump or replaying a finished reading.
        const progress = progressAt(elapsed)
        movement = { ...movement, duration, fromElapsed: elapsed, fromProgress: progress,
          end: progress >= 1 ? elapsed : Math.max(elapsed, duration * (1 - movement.hold)) }
      }
      const progress = progressAt(elapsed)
      return { progress, done: progress >= 1, nextIn: 0 }
    },
  }
}
export type ContinuousGroup = ReturnType<typeof createContinuousGroup>

interface ScrollGeometry { content: number; viewport: number; lineHeight: number; duration: number; reducedMotion: boolean; pageCount?: number; holdFraction?: number; continuousGroup?: ContinuousGroup }
export function projectionPosition({ content, viewport, lineHeight, duration, reducedMotion, pageCount, holdFraction, continuousGroup }: ScrollGeometry, elapsed: number) {
  const maximum = Math.max(0, content - viewport)
  if (maximum <= 2 || content <= 0 || viewport <= 0 || duration <= 0) return { y: 0, done: true, nextIn: 0 }
  const progress = Math.min(1, Math.max(0, elapsed / duration))
  const readingPosition = content * progress
  // Keep the estimated spoken line near the middle. Unlike the legacy calculation, this
  // reveals the final lines BEFORE the duration expires and gives both ends reading time.
  if (!reducedMotion) {
    if (continuousGroup) {
      const phase = continuousGroup.position(elapsed, duration)
      return phase ? { y: maximum * phase.progress, done: phase.done, nextIn: phase.nextIn }
        : { y: 0, done: false, nextIn: 250 }
    }
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
  // Shared geometry reports settle in the current commit before either column evaluates
  // the clock phase. Read the group live, never a previous React-state snapshot.
  const queue = () => { cancel(); if (!disposed) frame = schedule.frame(update) }
  const continuous = geometry.reducedMotion ? undefined : geometry.continuousGroup
  const unsubscribeGroup = continuous?.subscribe(queue)
  const unsubscribe = clock.subscribe(() => { if (continuous && clock.running()) queue(); else update() })
  if (continuous) queue()
  else update()
  return () => { disposed = true; cancel(); unsubscribe(); unsubscribeGroup?.() }
}
