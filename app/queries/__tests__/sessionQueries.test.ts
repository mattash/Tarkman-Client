import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSessions, fetchSessionParts, setPart, prevPart, nextPart } from '../sessions'
import { api } from '../../api'

// Mock api
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

const mockSessionData = {
  id: 1,
  liturgy: 'Divine Liturgy',
  liturgy_id: 1,
  date: '2024-03-20',
  church_name: 'St. Mary',
  church_avatar: 'https://example.com/avatar.jpg',
  occupied: true,
  num_of_parts: 10,
  current_part_position: 5,
  current_part_id: 123,
  current_liturgy_id: 1,
  page: 1,
  posture: 'standing',
  readings: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28'
  },
  options: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
    before_message: 'Before message',
    after_message: 'After message'
  }
}

const mockPartsResponse = {
  parts: [
    {
      part: {
        id: 123,
        role: 'priest',
        grabar: 'Գրաբար',
        translit: 'Grabar',
        hy_east: 'Հայերեն',
        hy_west: 'Հայերէն',
        ru: 'Русский',
        en: 'English',
        explanation_ids: [1, 2, 3],
        effective_duration_ms: 300000,
        position: 1
      }
    }
  ]
}

describe('sessionQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchSessions', () => {
    it('should fetch sessions successfully', async () => {
      const mockResponse = [{ session: mockSessionData }]
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await fetchSessions('UTC')
      expect(result).toEqual(mockResponse)
      expect(api.get).toHaveBeenCalledWith('/services.json', {
        params: {
          tz: 'UTC'
        }
      })
    })

    it('should handle fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))
      await expect(fetchSessions('UTC')).rejects.toThrow('Network error')
      consoleSpy.mockRestore()
    })
  })

  describe('fetchSessionParts', () => {
    it('should fetch session parts successfully', async () => {
      const mockPartsData = { parts: mockPartsResponse.parts }
      const mockSessionResponse = { session: mockSessionData }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSessionResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPartsData)
        } as Response)

      const result = await fetchSessionParts('1')
      expect(result).toEqual({
        parts: mockPartsData.parts,
        sessionData: mockSessionResponse
      })
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenCalledWith(`${import.meta.env.VITE_API_URL}/s/1.json`)
      expect(global.fetch).toHaveBeenCalledWith(`${import.meta.env.VITE_API_URL}/s/1/parts.json`)
    })

    it('falls back to liturgy parts when session parts fail', async () => {
      const mockSessionResponse = { session: mockSessionData }
      const mockLiturgyParts = { parts: mockPartsResponse.parts }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSessionResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: vi.fn()
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLiturgyParts)
        } as Response)

      const result = await fetchSessionParts('1')
      expect(result).toEqual({
        parts: mockLiturgyParts.parts,
        sessionData: mockSessionResponse
      })
      expect(global.fetch).toHaveBeenCalledWith(`${import.meta.env.VITE_API_URL}/liturgies/1/parts.json`)
    })

    it('should handle fetch error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: vi.fn()
      } as unknown as Response)
      await expect(fetchSessionParts('1')).rejects.toThrow('Failed to fetch session 1')
    })
  })

  describe('setPart', () => {
    it('should set part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 123 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await setPart('1', 123)
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/set_part.json', { part_id: 123, transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(setPart('1', 123)).rejects.toThrow('API error')
    })
  })

  describe('prevPart', () => {
    it('should go to previous part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 122 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await prevPart('1')
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/prev.json', { transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(prevPart('1')).rejects.toThrow('API error')
    })
  })

  describe('nextPart', () => {
    it('should go to next part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 124 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await nextPart('1')
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/next.json', { transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(nextPart('1')).rejects.toThrow('API error')
    })
  })
}) 
