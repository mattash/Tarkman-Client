import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LanguageProvider, useLanguage, type Language } from '../LanguageContext'

describe('LanguageContext', () => {
  describe('useLanguage hook', () => {
    it('should throw error when used outside LanguageProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error')
      consoleSpy.mockImplementation(() => {})

      expect(() => {
        renderHook(() => useLanguage())
      }).toThrow('useLanguage must be used within a LanguageProvider')

      consoleSpy.mockRestore()
    })

    it('should provide initial state with "en" as default language', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      expect(result.current.selectedLang).toBe('en')
      expect(result.current.readingLanguagesBySession).toEqual({})
      expect(result.current.activeReadingLanguageBySession).toEqual({})
    })
  })

  describe('setSelectedLang', () => {
    it('should update selected language to "ru"', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setSelectedLang('ru')
      })

      expect(result.current.selectedLang).toBe('ru')
    })

    it('should update selected language to "grabar"', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setSelectedLang('grabar')
      })

      expect(result.current.selectedLang).toBe('grabar')
    })

    it('should update selected language to "translit"', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setSelectedLang('translit')
      })

      expect(result.current.selectedLang).toBe('translit')
    })

    it('should handle multiple language changes', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      const languages: Language[] = ['ru', 'grabar', 'translit', 'en']

      languages.forEach((lang) => {
        act(() => {
          result.current.setSelectedLang(lang)
        })
        expect(result.current.selectedLang).toBe(lang)
      })
    })
  })

  describe('state persistence', () => {
    it('should maintain language selection across re-renders', () => {
      const { result, rerender } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setSelectedLang('ru')
      })

      rerender()

      expect(result.current.selectedLang).toBe('ru')
    })

    it('preserves a session reading selection without changing other sessions', () => {
      const { result, rerender } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setReadingLanguagesForSession('service-1', ['ru', 'en'])
      })
      rerender()

      expect(result.current.readingLanguagesBySession).toEqual({ 'service-1': ['ru', 'en'] })
      expect(result.current.readingLanguagesBySession['service-2']).toBeUndefined()
    })

    it('preserves the active reading language independently for each session', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      })

      act(() => {
        result.current.setActiveReadingLanguageForSession('service-1', 'grabar')
        result.current.setActiveReadingLanguageForSession('service-2', 'ru')
      })

      expect(result.current.activeReadingLanguageBySession).toEqual({
        'service-1': 'grabar',
        'service-2': 'ru',
      })
    })
  })
})
