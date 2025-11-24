import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import type { User } from '@/types/auth'

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')
    })

    it('should provide initial state with null user and token', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })
  })

  describe('setAuth', () => {
    it('should update user and token state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: [],
      }
      const mockToken = 'test-token-123'

      act(() => {
        result.current.setAuth(mockUser, mockToken)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toEqual(mockToken)
    })

    it('should persist user and token to localStorage', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: [],
      }
      const mockToken = 'test-token-123'

      act(() => {
        result.current.setAuth(mockUser, mockToken)
      })

      expect(localStorage.getItem('token')).toBe(mockToken)
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser))
    })

    it('should remove user and token from localStorage when set to null', () => {
      // First set the auth
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: [],
      }

      act(() => {
        result.current.setAuth(mockUser, 'test-token')
      })

      expect(localStorage.getItem('token')).toBeTruthy()
      expect(localStorage.getItem('user')).toBeTruthy()

      // Then clear it
      act(() => {
        result.current.setAuth(null, null)
      })

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear user and token state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: [],
      }

      act(() => {
        result.current.setAuth(mockUser, 'test-token')
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toBe('test-token')

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })

    it('should remove user and token from localStorage', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      act(() => {
        result.current.setAuth({ id: 1, email: 'test@example.com', name: 'Test', roles: [] }, 'test-token')
      })

      act(() => {
        result.current.logout()
      })

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })
  })

  describe('initialization from localStorage', () => {
    it('should restore user and token from localStorage on mount', () => {
      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: [],
      }
      const mockToken = 'saved-token-123'

      localStorage.setItem('token', mockToken)
      localStorage.setItem('user', JSON.stringify(mockUser))

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toEqual(mockToken)
    })

    it('should handle missing localStorage data', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })

    it('should handle empty localStorage gracefully', () => {
      localStorage.setItem('token', '')
      localStorage.setItem('user', '')

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Should not restore from empty values
      expect(result.current.token).toBeNull()
      expect(result.current.user).toBeNull()
    })
  })
})

