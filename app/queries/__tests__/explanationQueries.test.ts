import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchExplanation,
  fetchCurrentExplanation,
  fetchUpcomingExplanations,
  fetchLiturgyExplanations,
  fetchLiturgyExplanation,
  fetchPartExplanations,
  fetchExplanationCitations,
  fetchExplanationRatings,
  explanationQueryKeys
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

const mockCitation = {
  id: 1,
  citation_type: 0,
  text: 'John 3:16',
  source: 'Bible',
  url: 'https://example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

const mockCitationsResponse = {
  citations: [mockCitation, { ...mockCitation, id: 2, citation_type: 1 }]
}

const mockRatingsResponse = {
  average_rating: 4.5,
  rating_count: 10,
  ratings: [
    {
      id: 1,
      explanation_id: 1,
      user_id: 1,
      rating: 5,
      comment: 'Great explanation!',
      created_at: '2024-01-01T00:00:00Z'
    }
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

  describe('fetchUpcomingExplanations', () => {
    it('should fetch upcoming explanations with default lookahead', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanationsResponse)
      })

      const result = await fetchUpcomingExplanations('123')
      expect(result).toEqual(mockExplanationsResponse.explanations.map(e => e.explanation))
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/s/123/explanations/upcoming.json?lookahead=3')
      )
    })

    it('should fetch upcoming explanations with custom lookahead', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanationsResponse)
      })

      const result = await fetchUpcomingExplanations('123', 5)
      expect(result).toEqual(mockExplanationsResponse.explanations.map(e => e.explanation))
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/s/123/explanations/upcoming.json?lookahead=5')
      )
    })

    it('should return empty array for 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await fetchUpcomingExplanations('123')
      expect(result).toEqual([])
    })

    it('should throw an error when the request fails with non-404 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(fetchUpcomingExplanations('123')).rejects.toThrow(
        'Failed to fetch upcoming explanations'
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

    it('should return empty array for 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await fetchPartExplanations('123', '1')
      expect(result).toEqual([])
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(fetchPartExplanations('123', '1')).rejects.toThrow(
        'Failed to fetch part explanations for part 1'
      )
    })
  })

  describe('fetchExplanationCitations', () => {
    it('should fetch explanation citations', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCitationsResponse)
      })

      const result = await fetchExplanationCitations('123', '1')
      expect(result).toEqual(mockCitationsResponse.citations)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/liturgies/123/explanations/1/citations.json')
      )
    })

    it('should return empty array for 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await fetchExplanationCitations('123', '1')
      expect(result).toEqual([])
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(fetchExplanationCitations('123', '1')).rejects.toThrow(
        'Failed to fetch citations'
      )
    })

    it('should handle missing citations array in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ citations: null })
      })

      const result = await fetchExplanationCitations('123', '1')
      expect(result).toEqual([])
    })
  })

  describe('fetchExplanationRatings', () => {
    it('should fetch explanation ratings', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRatingsResponse)
      })

      const result = await fetchExplanationRatings('123', '1')
      expect(result).toEqual(mockRatingsResponse)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/liturgies/123/explanations/1/ratings.json')
      )
    })

    it('should return zero ratings for 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await fetchExplanationRatings('123', '1')
      expect(result).toEqual({
        average_rating: 0,
        rating_count: 0,
        ratings: []
      })
    })

    it('should throw an error when the request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(fetchExplanationRatings('123', '1')).rejects.toThrow(
        'Failed to fetch ratings'
      )
    })
  })

  describe('explanationQueryKeys', () => {
    it('should generate correct query keys for current', () => {
      const key = explanationQueryKeys.current('session123')
      expect(key).toEqual(['explanation', 'session123', 'current'])
    })

    it('should generate correct query keys for upcoming', () => {
      const key = explanationQueryKeys.upcoming('session123')
      expect(key).toEqual(['explanation', 'session123', 'upcoming'])
    })

    it('should generate correct query keys for citations', () => {
      const key = explanationQueryKeys.citations('liturgy123', 'explanation456')
      expect(key).toEqual(['explanation', 'liturgy', 'liturgy123', 'explanation456', 'citations'])
    })

    it('should generate correct query keys for ratings', () => {
      const key = explanationQueryKeys.ratings('liturgy123', 'explanation456')
      expect(key).toEqual(['explanation', 'liturgy', 'liturgy123', 'explanation456', 'ratings'])
    })
  })
}) 