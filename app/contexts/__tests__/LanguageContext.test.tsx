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
  })
})
