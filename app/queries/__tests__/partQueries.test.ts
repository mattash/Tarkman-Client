import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPart } from '../partQueries'

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
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchPart', () => {
    it('should fetch part details successfully', async () => {
      const mockResponse = { part: mockPart }
      const mockFetch = vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await fetchPart('123', 1)

      expect(mockFetch).toHaveBeenCalledWith(
        `${import.meta.env.VITE_API_URL}/s/123/parts/1.json`
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle non-ok response', async () => {
      const mockFetch = vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(fetchPart('123', 1)).rejects.toThrow('Failed to fetch part')
    })

    it('should handle network error', async () => {
      const mockFetch = vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(fetchPart('123', 1)).rejects.toThrow('Network error')
    })
  })
}) 