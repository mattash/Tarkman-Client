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

interface ScrollGeometry { content: number; viewport: number; lineHeight: number; duration: number; reducedMotion: boolean }
export function projectionPosition({ content, viewport, lineHeight, duration, reducedMotion }: ScrollGeometry, elapsed: number) {
  const maximum = Math.max(0, content - viewport)
  if (maximum <= 2 || content <= 0 || viewport <= 0 || duration <= 0) return { y: 0, done: true, nextIn: 0 }
  const progress = Math.min(1, Math.max(0, elapsed / duration))
  const readingPosition = content * progress
  // Keep the estimated spoken line near the middle. Unlike the legacy calculation, this
  // reveals the final lines BEFORE the duration expires and gives both ends reading time.
  if (!reducedMotion) {
    const y = Math.min(maximum, Math.max(0, readingPosition - viewport / 2))
    return { y, done: y >= maximum, nextIn: Math.max(0, viewport / 2 / content * duration - elapsed) }
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
