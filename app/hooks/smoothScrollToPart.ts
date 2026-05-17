interface ScrollRefs {
  animation: { current: number | null }
  timeout: { current: number | null }
}

const FALLBACK_SPEED = 0.15

/**
 * Smooth-scrolls to a part element.
 *
 * - Snap-scrolls the element to 1/4 viewport from the top.
 * - If the element is taller than the viewport, auto-scrolls through
 *   its content using either the duration from `data-duration-ms` or a
 *   fixed fallback speed.
 * - Cancels any previous animation or timeout on the same refs.
 */
export function smoothScrollToPart(element: HTMLElement, refs: ScrollRefs): void {
  // --- Parse and validate effective_duration_ms ---
  const effectiveDurationMsAttr = element.getAttribute('data-duration-ms')
  const raw = effectiveDurationMsAttr != null ? Number(effectiveDurationMsAttr) : 0
  const effectiveDurationMs = Number.isFinite(raw) && raw > 0 ? raw : 0

  // --- Cancel any existing animation / timeout ---
  if (refs.animation.current !== null) {
    cancelAnimationFrame(refs.animation.current)
    refs.animation.current = null
  }
  if (refs.timeout.current !== null) {
    clearTimeout(refs.timeout.current)
    refs.timeout.current = null
  }

  // --- Snap-scroll to part ---
  const elementRect = element.getBoundingClientRect()
  const elementHeight = elementRect.height
  const viewportHeight = window.innerHeight

  const oneFourthViewportOffset = viewportHeight / 4
  const topPosition = window.scrollY + elementRect.top - oneFourthViewportOffset
  window.scrollTo({ top: topPosition, behavior: 'instant' } as ScrollToOptions)

  // --- Short part: no auto-scroll needed ---
  if (elementHeight <= viewportHeight) {
    return
  }

  const initiallyVisibleHeight = Math.max(
    0,
    Math.min(elementHeight, viewportHeight - oneFourthViewportOffset)
  )
  const remainingHeight = elementHeight - initiallyVisibleHeight

  if (remainingHeight <= 0) {
    return
  }

  const scrollDistance = remainingHeight
  const remainingPercent = scrollDistance / elementHeight
  const targetDuration = effectiveDurationMs * remainingPercent || 0
  const delayBeforeScroll = effectiveDurationMs * (1 - remainingPercent) || 0

  // --- Auto-scroll loop ---
  const startScrollAnimation = () => {
    const startTime = performance.now()
    const startPosition = window.scrollY

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = targetDuration > 0
        ? Math.min(elapsed / targetDuration, 1)
        : Math.min((elapsed * FALLBACK_SPEED) / scrollDistance, 1)

      if (progress < 1) {
        window.scrollTo(0, startPosition + scrollDistance * progress)
        refs.animation.current = requestAnimationFrame(animate)
      } else {
        window.scrollTo(0, startPosition + scrollDistance)
        refs.animation.current = null
      }
    }

    // Single RAF chain — the id is stored so cancellation always works.
    refs.animation.current = requestAnimationFrame(animate)
  }

  if (delayBeforeScroll > 0) {
    refs.timeout.current = window.setTimeout(startScrollAnimation, delayBeforeScroll)
  } else {
    startScrollAnimation()
  }
}
