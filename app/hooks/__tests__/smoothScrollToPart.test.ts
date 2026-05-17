import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { smoothScrollToPart } from '../smoothScrollToPart'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRefs() {
  return {
    animation: { current: null as number | null },
    timeout: { current: null as number | null },
  }
}

function installFakeTimersAndRaf() {
  vi.useFakeTimers({ shouldAdvanceTime: true })

  let id = 0
  const callbacks = new Map<number, FrameRequestCallback>()

  const raf = vi.fn((cb: FrameRequestCallback) => {
    const nextId = ++id
    callbacks.set(nextId, cb)
    return nextId
  })
  const caf = vi.fn((cancelId: number) => {
    callbacks.delete(cancelId)
  })

  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)

  return {
    raf,
    caf,
    advance(count = 1, msPerFrame = 16) {
      for (let f = 0; f < count; f++) {
        vi.advanceTimersByTime(msPerFrame)
        const entries = Array.from(callbacks.entries())
        callbacks.clear()
        for (const [, cb] of entries) {
          cb(performance.now())
        }
      }
    },
    pending() {
      return callbacks.size
    },
  }
}

function spyOnScroll() {
  let _scrollY = 0

  const scrollTo = vi.fn((x: unknown, y?: unknown) => {
    if (typeof x === 'object' && x !== null && 'top' in x) {
      _scrollY = (x as { top: number }).top
    } else if (typeof y === 'number') {
      _scrollY = y
    }
  })

  vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo as any)
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => _scrollY)

  return { scrollTo, getScrollY: () => _scrollY, setScrollY: (y: number) => { _scrollY = y } }
}

function createElement({
  height = 400,
  top = 0,
  durationMs = null as string | null,
}: {
  height?: number
  top?: number
  durationMs?: string | null
} = {}) {
  const el = document.createElement('div')

  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + height,
    left: 0,
    right: 800,
    width: 800,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)

  vi.spyOn(el, 'getAttribute').mockImplementation((name: string) => {
    if (name === 'data-duration-ms') return durationMs
    return null
  })

  return el
}

// ---------------------------------------------------------------------------
// P0 — core scroll behavior
// ---------------------------------------------------------------------------

describe('smoothScrollToPart (P0)', () => {
  let timers: ReturnType<typeof installFakeTimersAndRaf>
  let scroll: ReturnType<typeof spyOnScroll>

  beforeEach(() => {
    timers = installFakeTimersAndRaf()
    scroll = spyOnScroll()
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('short part snap-scrolls only (no RAF, no timeout)', () => {
    const refs = createRefs()
    const el = createElement({ height: 300 })

    smoothScrollToPart(el, refs)

    expect(scroll.scrollTo).toHaveBeenCalledTimes(1)
    expect(scroll.scrollTo.mock.calls[0][0]).toMatchObject({ behavior: 'instant' })
    expect(timers.raf).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('long part: computes delay + scroll duration from effective_duration_ms', () => {
    const refs = createRefs()
    const el = createElement({ height: 2000, durationMs: '60000' })

    smoothScrollToPart(el, refs)

    expect(scroll.scrollTo).toHaveBeenCalledTimes(1)
    expect(scroll.scrollTo.mock.calls[0][0]).toMatchObject({ behavior: 'instant' })

    // remaining = 1400, delay = 60000 * 0.3 = 18000
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(18000)
    expect(timers.raf).toHaveBeenCalled()
  })

  it('auto-scroll: RAF advances position and reaches final position', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: '30000' })

    smoothScrollToPart(el, refs)
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(6000) // past the delay
    timers.advance(1500) // enough frames for full animation

    // Final position = snap-offset position (-200) + scrollDistance (2400) = 2200
    const lastCall = scroll.scrollTo.mock.calls[scroll.scrollTo.mock.calls.length - 1]
    expect(lastCall[1]).toBe(2200)
    expect(refs.animation.current).toBeNull()
  })

  it('new part cancels previous timeout', () => {
    const refs = createRefs()
    const el1 = createElement({ height: 3000, durationMs: '60000' })
    smoothScrollToPart(el1, refs)
    expect(vi.getTimerCount()).toBe(1)

    // Spy on clearTimeout to verify the pending timeout from el1 is cancelled
    const ctSpy = vi.spyOn(window, 'clearTimeout')

    const el2 = createElement({ height: 3000, durationMs: '5000' })
    smoothScrollToPart(el2, refs)

    // The pending timeout from el1 should be cleared, new one registered
    expect(ctSpy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1) // new timeout registered
  })
})

// ---------------------------------------------------------------------------
// P1 — edge cases
// ---------------------------------------------------------------------------

describe('smoothScrollToPart (P1)', () => {
  let timers: ReturnType<typeof installFakeTimersAndRaf>
  let scroll: ReturnType<typeof spyOnScroll>

  beforeEach(() => {
    timers = installFakeTimersAndRaf()
    scroll = spyOnScroll()
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('missing duration uses fallback speed (targetDuration = 0)', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000 })

    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
    expect(timers.raf).toHaveBeenCalled()
  })

  it('empty string duration treated as fallback', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: '' })
    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('non-numeric string duration treated as fallback', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: 'not-a-number' })
    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('negative duration -1000 rejected, falls back to 0', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: '-1000' })
    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
    expect(timers.raf).toHaveBeenCalled()
  })

  it('infinite duration Infinity rejected, falls back to 0', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: 'Infinity' })
    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
    expect(timers.raf).toHaveBeenCalled()
  })

  it('negative infinity -Infinity rejected, falls back to 0', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: '-Infinity' })
    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(0)
    expect(timers.raf).toHaveBeenCalled()
  })

  it('element exactly viewport height does not auto-scroll', () => {
    const refs = createRefs()
    const el = createElement({ height: 800 })

    smoothScrollToPart(el, refs)
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1)
    expect(timers.raf).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tall element triggers auto-scroll animation', () => {
    const refs = createRefs()
    scroll.setScrollY(0)
    const el = createElement({ height: 2000 })

    smoothScrollToPart(el, refs)
    const hasAnimation = vi.getTimerCount() > 0 || timers.raf.mock.calls.length > 0
    expect(hasAnimation).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// P2 — advanced scenarios
// ---------------------------------------------------------------------------

describe('smoothScrollToPart (P2)', () => {
  let timers: ReturnType<typeof installFakeTimersAndRaf>
  let scroll: ReturnType<typeof spyOnScroll>

  beforeEach(() => {
    timers = installFakeTimersAndRaf()
    scroll = spyOnScroll()
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('element at document top produces clamped snap scroll', () => {
    const refs = createRefs()
    const el = createElement({ height: 2000, top: 0, durationMs: '30000' })

    smoothScrollToPart(el, refs)

    const snapCall = scroll.scrollTo.mock.calls[0][0]
    expect(snapCall.top).toBe(-200)
  })

  it('very tall element with fallback speed completes animation', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000 })

    smoothScrollToPart(el, refs)
    timers.advance(1200, 16)

    // Final position = snap-offset (-200) + scrollDistance (2400) = 2200
    const lastCall = scroll.scrollTo.mock.calls[scroll.scrollTo.mock.calls.length - 1]
    expect(lastCall[1]).toBe(2200)
    expect(refs.animation.current).toBeNull()
  })

  it('very large but finite duration is accepted', () => {
    const refs = createRefs()
    const el = createElement({ height: 3000, durationMs: '999999999' })

    smoothScrollToPart(el, refs)
    expect(vi.getTimerCount()).toBe(1)
  })
})
