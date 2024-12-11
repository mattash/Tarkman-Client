import { useCallback, useRef } from 'react'

interface UpdateData {
  part: string | number
}

export function usePartScroll() {
  const partsRef = useRef<Record<string, HTMLElement>>({})
  const focusedElementRef = useRef<HTMLElement | null>(null)

  const handlePartUpdated = useCallback((data: UpdateData | string) => {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data
    const { part } = parsedData
    const element = partsRef.current[part]

    if (element) {
      const stickyElement = document.querySelector('.sticky') as HTMLElement
      if (!stickyElement) return
      const offset = stickyElement.offsetHeight

      if (focusedElementRef.current) {
        focusedElementRef.current.classList.remove('mt-14', 'focus')
      }

      element.classList.add('focus', 'mt-14', 'animate-flash')
      focusedElementRef.current = element

      setTimeout(() => {
        element.classList.remove('animate-flash')
      }, 1000)

      element.scrollIntoView({ behavior: 'auto', block: 'start' })
      requestAnimationFrame(() => {
        window.scrollBy(0, -offset)
      })
    }
  }, [])

  return {
    partsRef,
    focusedElementRef,
    handlePartUpdated
  }
} 