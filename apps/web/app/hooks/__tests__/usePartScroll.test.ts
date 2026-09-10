import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePartScroll } from '../usePartScroll'

describe('usePartScroll', () => {
  beforeEach(() => {
    // Mock DOM methods
    Element.prototype.scrollIntoView = vi.fn()
    window.scrollBy = vi.fn()
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('should initialize with empty refs', () => {
    const { result } = renderHook(() => usePartScroll())

    expect(result.current.partsRef.current).toEqual({})
    expect(result.current.focusedElementRef.current).toBeNull()
  })

  it('should provide handlePartUpdated function', () => {
    const { result } = renderHook(() => usePartScroll())

    expect(result.current.handlePartUpdated).toBeDefined()
    expect(typeof result.current.handlePartUpdated).toBe('function')
  })

  it('should handle part update with string data', () => {
    const { result } = renderHook(() => usePartScroll())

    // Create a mock element
    const mockElement = document.createElement('div')
    mockElement.classList.add = vi.fn()
    mockElement.classList.remove = vi.fn()
    mockElement.scrollIntoView = vi.fn()

    // Add element to partsRef
    act(() => {
      result.current.partsRef.current['123'] = mockElement
    })

    // Call handlePartUpdated with string data
    act(() => {
      result.current.handlePartUpdated(JSON.stringify({ part: '123' }))
    })

    expect(mockElement.classList.add).toHaveBeenCalledWith('focus', 'mt-14', 'animate-flash')
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('should handle part update with object data', () => {
    const { result } = renderHook(() => usePartScroll())

    const mockElement = document.createElement('div')
    mockElement.classList.add = vi.fn()
    mockElement.classList.remove = vi.fn()
    mockElement.scrollIntoView = vi.fn()

    act(() => {
      result.current.partsRef.current['456'] = mockElement
    })

    act(() => {
      result.current.handlePartUpdated({ part: '456' })
    })

    expect(mockElement.classList.add).toHaveBeenCalledWith('focus', 'mt-14', 'animate-flash')
    expect(mockElement.scrollIntoView).toHaveBeenCalled()
  })

  it('should remove animate-flash class after timeout', () => {
    const { result } = renderHook(() => usePartScroll())

    const mockElement = document.createElement('div')
    mockElement.classList.add = vi.fn()
    mockElement.classList.remove = vi.fn()
    mockElement.scrollIntoView = vi.fn()

    act(() => {
      result.current.partsRef.current['789'] = mockElement
    })

    act(() => {
      result.current.handlePartUpdated({ part: '789' })
    })

    expect(mockElement.classList.add).toHaveBeenCalled()

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(mockElement.classList.remove).toHaveBeenCalledWith('animate-flash')
  })

  it('should remove focus from previously focused element', () => {
    const { result } = renderHook(() => usePartScroll())

    const firstElement = document.createElement('div')
    firstElement.classList.add = vi.fn()
    firstElement.classList.remove = vi.fn()
    firstElement.scrollIntoView = vi.fn()

    const secondElement = document.createElement('div')
    secondElement.classList.add = vi.fn()
    secondElement.classList.remove = vi.fn()
    secondElement.scrollIntoView = vi.fn()

    act(() => {
      result.current.partsRef.current['1'] = firstElement
      result.current.partsRef.current['2'] = secondElement
    })

    // Focus first element
    act(() => {
      result.current.handlePartUpdated({ part: '1' })
    })

    expect(firstElement.classList.add).toHaveBeenCalled()

    // Focus second element
    act(() => {
      result.current.handlePartUpdated({ part: '2' })
    })

    expect(firstElement.classList.remove).toHaveBeenCalledWith('mt-14', 'focus')
    expect(secondElement.classList.add).toHaveBeenCalled()
  })

  it('should handle missing element gracefully', () => {
    const { result } = renderHook(() => usePartScroll())

    // Call with non-existent part ID
    expect(() => {
      act(() => {
        result.current.handlePartUpdated({ part: 'non-existent' })
      })
    }).not.toThrow()
  })

  it('should use requestAnimationFrame for scroll offset adjustment', () => {
    const { result } = renderHook(() => usePartScroll())

    // Create sticky element
    const stickyElement = document.createElement('div')
    stickyElement.className = 'sticky'
    Object.defineProperty(stickyElement, 'offsetHeight', { value: 100 })
    document.body.appendChild(stickyElement)

    const mockElement = document.createElement('div')
    mockElement.classList.add = vi.fn()
    mockElement.classList.remove = vi.fn()
    mockElement.scrollIntoView = vi.fn()

    act(() => {
      result.current.partsRef.current['test'] = mockElement
    })

    act(() => {
      result.current.handlePartUpdated({ part: 'test' })
    })

    // requestAnimationFrame should have been called to adjust scroll position
    expect(global.requestAnimationFrame).toHaveBeenCalled()
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })

    // Cleanup
    document.body.removeChild(stickyElement)
  })

  it('should handle numeric part IDs', () => {
    const { result } = renderHook(() => usePartScroll())

    const mockElement = document.createElement('div')
    mockElement.classList.add = vi.fn()
    mockElement.classList.remove = vi.fn()
    mockElement.scrollIntoView = vi.fn()

    act(() => {
      result.current.partsRef.current['100'] = mockElement
    })

    act(() => {
      result.current.handlePartUpdated({ part: 100 })
    })

    expect(mockElement.scrollIntoView).toHaveBeenCalled()
  })
})
