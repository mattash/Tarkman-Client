import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSessions, fetchSessionParts, setPart, prevPart, nextPart, updateSessionStatus } from '../sessions'
import { api } from '../../api'

// Mock api
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn()
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
    beforeEach(() => {
      vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should fetch session parts successfully', async () => {
      const mockPartsData = { parts: mockPartsResponse.parts }
      const mockSessionResponse = { session: mockSessionData }

      vi.mocked(global.fetch)
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
    })

    it('falls back to liturgy parts when session parts fail', async () => {
      const mockSessionResponse = { session: mockSessionData }
      const mockLiturgyParts = { parts: mockPartsResponse.parts }

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSessionResponse)
        } as Response)
        .mockResolvedValueOnce({ ok: false } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLiturgyParts)
        } as Response)

      const result = await fetchSessionParts('1')
      expect(result).toEqual({
        parts: mockLiturgyParts.parts,
        sessionData: mockSessionResponse
      })
      expect(global.fetch).toHaveBeenCalledWith(
        `${import.meta.env.VITE_API_URL}/liturgies/1/parts.json`
      )
    })

    it('should handle fetch error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false } as Response)
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

  describe('updateSessionStatus', () => {
    it('should update status to paused successfully', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'paused' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'paused' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'paused' })
    })

    it('should update status with custom message', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'showing_custom' as const,
        status_message: 'Test announcement'
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', {
        status: 'showing_custom',
        status_message: 'Test announcement'
      })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', {
        status: 'showing_custom',
        status_message: 'Test announcement'
      })
    })

    it('should update status to showing_gospel', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'showing_gospel' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'showing_gospel' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'showing_gospel' })
    })

    it('should update status back to active', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'active' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'active' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'active' })
    })

    it('should handle API error', async () => {
      vi.mocked(api.patch).mockRejectedValueOnce(new Error('Unauthorized'))
      await expect(updateSessionStatus('1', { status: 'paused' })).rejects.toThrow('Unauthorized')
    })
  })
}) 
