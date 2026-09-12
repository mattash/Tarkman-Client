import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  READING_APPEARANCE_STORAGE_KEY,
  getReadingAppearanceStorage,
  loadReadingAppearance,
  resolveReadingAppearance,
  saveReadingAppearance,
  useReadingAppearance,
} from '../useReadingAppearance'

describe('reading appearance preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    delete document.documentElement.dataset.tarkmanReadingTheme
  })

  it('resolves system appearance while explicit choices take precedence', () => {
    expect(resolveReadingAppearance('system', true)).toBe('dark')
    expect(resolveReadingAppearance('system', false)).toBe('light')
    expect(resolveReadingAppearance('light', true)).toBe('light')
    expect(resolveReadingAppearance('dark', false)).toBe('dark')
  })

  it('loads only supported stored values and defaults safely', () => {
    expect(loadReadingAppearance({ getItem: () => 'dark' })).toBe('dark')
    expect(loadReadingAppearance({ getItem: () => 'sepia' })).toBe('system')
    expect(loadReadingAppearance({ getItem: () => { throw new Error('blocked') } })).toBe('system')
    expect(loadReadingAppearance(null)).toBe('system')
  })

  it('tolerates browsers that block access to the storage property', () => {
    const blockedWindow = Object.create(null) as { readonly localStorage: Storage }
    Object.defineProperty(blockedWindow, 'localStorage', {
      get: () => { throw new DOMException('blocked', 'SecurityError') },
    })

    expect(getReadingAppearanceStorage(blockedWindow)).toBeNull()
  })

  it('reports write failure without throwing', () => {
    const setItem = vi.fn(() => { throw new Error('quota') })
    expect(saveReadingAppearance({ setItem }, 'light')).toBe(false)
    expect(setItem).toHaveBeenCalledWith(READING_APPEARANCE_STORAGE_KEY, 'light')
    expect(saveReadingAppearance(null, 'dark')).toBe(false)
  })

  it('tracks OS changes in system mode and lets an explicit choice win', () => {
    let prefersDark = false
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return prefersDark },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        changeListener = listener
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList)))

    const { result } = renderHook(() => useReadingAppearance())
    expect(result.current.resolvedAppearance).toBe('light')

    act(() => {
      prefersDark = true
      changeListener?.({ matches: true } as MediaQueryListEvent)
    })
    expect(result.current.resolvedAppearance).toBe('dark')
    expect(document.documentElement.dataset.tarkmanReadingTheme).toBe('dark')

    act(() => result.current.setAppearance('light'))
    expect(result.current.resolvedAppearance).toBe('light')
    expect(localStorage.setItem).toHaveBeenCalledWith(READING_APPEARANCE_STORAGE_KEY, 'light')
  })
})
