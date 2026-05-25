import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPart } from '../partQueries'
import { api } from '@/api'

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('partQueries', () => {
  const mockPart = {
    id: 1,
    role: 'priest',
    grabar: 'Գրաբար տեքստ',
    translit: 'Grabar text',
    hy_east: 'Արևելահայերեն տեքստ',
    hy_west: 'Արևմտահայերեն տեքստ',
    ru: 'Русский текст',
    en: 'English text',
    explanation_ids: [1, 2, 3],
    effective_duration_ms: 60000,
    position: 1,
    duration_type: 'fixed',
    page: 1,
    posture: 'standing'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchPart', () => {
    it('should fetch part details successfully', async () => {
      const mockResponse = { part: mockPart }
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await fetchPart('123', 1)

      expect(api.get).toHaveBeenCalledWith('/s/123/parts/1.json')
      expect(result).toEqual(mockResponse)
    })

    it('should handle non-ok response', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Failed to fetch part'))

      await expect(fetchPart('123', 1)).rejects.toThrow('Failed to fetch part')
    })

    it('should handle network error', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(fetchPart('123', 1)).rejects.toThrow('Network error')
    })
  })
}) 
