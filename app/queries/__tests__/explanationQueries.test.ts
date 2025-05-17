import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchExplanation,
  fetchCurrentExplanation,
  fetchLiturgyExplanations,
  fetchLiturgyExplanation,
  fetchPartExplanations
} from '../explanationQueries'

const mockExplanation = {
  id: 1,
  title: 'Test Explanation',
  description: 'Test Description',
  part_ids: [1, 2, 3],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  row_order: 1
}

const mockExplanationsResponse = {
  explanations: [
    { explanation: mockExplanation },
    { explanation: { ...mockExplanation, id: 2 } }
  ]
}

describe('explanationQueries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchExplanation', () => {
    it('should fetch a single explanation', async () => {
      const mockResponse = { explanation: mockExplanation }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await fetchExplanation('123', '1')
      expect(result).toEqual(mockExplanation)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/s/123/explanations/1.json')
      )
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false
      })

      await expect(fetchExplanation('123', '1')).rejects.toThrow(
        'Failed to fetch explanation 1'
      )
    })
  })

  describe('fetchCurrentExplanation', () => {
    it('should fetch current explanations', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanationsResponse)
      })

      const result = await fetchCurrentExplanation('123')
      expect(result).toEqual(mockExplanationsResponse.explanations.map(e => e.explanation))
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/s/123/explanations/current.json')
      )
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false
      })

      await expect(fetchCurrentExplanation('123')).rejects.toThrow(
        'Failed to fetch current explanation'
      )
    })
  })

  describe('fetchLiturgyExplanations', () => {
    it('should fetch liturgy explanations', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanationsResponse)
      })

      const result = await fetchLiturgyExplanations('123')
      expect(result).toEqual(mockExplanationsResponse.explanations.map(e => e.explanation))
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/liturgies/123/explanations.json')
      )
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false
      })

      await expect(fetchLiturgyExplanations('123')).rejects.toThrow(
        'Failed to fetch liturgy explanations'
      )
    })
  })

  describe('fetchLiturgyExplanation', () => {
    it('should fetch a single liturgy explanation', async () => {
      const mockResponse = { explanation: mockExplanation }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await fetchLiturgyExplanation('123', '1')
      expect(result).toEqual(mockExplanation)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/liturgies/123/explanations/1.json')
      )
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false
      })

      await expect(fetchLiturgyExplanation('123', '1')).rejects.toThrow(
        'Failed to fetch liturgy explanation 1'
      )
    })
  })

  describe('fetchPartExplanations', () => {
    it('should fetch part explanations', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanationsResponse)
      })

      const result = await fetchPartExplanations('123', '1')
      expect(result).toEqual(mockExplanationsResponse.explanations.map(e => e.explanation))
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/liturgies/123/parts/1/explanations.json')
      )
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false
      })

      await expect(fetchPartExplanations('123', '1')).rejects.toThrow(
        'Failed to fetch part explanations for part 1'
      )
    })
  })
}) 