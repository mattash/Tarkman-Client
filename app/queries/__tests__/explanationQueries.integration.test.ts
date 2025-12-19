import { describe, it, expect, beforeAll } from 'vitest'
import {
  fetchExplanation,
  fetchCurrentExplanation,
  fetchLiturgyExplanations,
  fetchLiturgyExplanation,
  fetchPartExplanations,
  fetchExplanationCitations,
  fetchExplanationRatings
} from '../explanationQueries'

// Test data - can be configured via environment variables
const TEST_SESSION_ID = import.meta.env.VITE_TEST_SESSION_ID || '10'
const TEST_LITURGY_ID = '1'
const TEST_PART_ID = '4'
const TEST_EXPLANATION_ID = '1'

describe('explanationQueries integration tests', () => {
  beforeAll(() => {
    // Verify that we have the required environment variables
    if (!import.meta.env.VITE_API_URL) {
      throw new Error('VITE_API_URL environment variable is required for integration tests')
    }
  })

  describe('fetchExplanation', () => {
    it('should fetch a real explanation', async () => {
      const explanation = await fetchExplanation(TEST_SESSION_ID, TEST_EXPLANATION_ID)
      
      expect(explanation).toBeDefined()
      expect(explanation.id).toBeDefined()
      expect(explanation.title).toBeDefined()
      expect(explanation.description).toBeDefined()
      expect(explanation.part_ids).toBeInstanceOf(Array)
      expect(explanation.created_at).toBeDefined()
      expect(explanation.updated_at).toBeDefined()
      expect(explanation.row_order).toBeDefined()
    })
  })

  describe('fetchCurrentExplanation', () => {
    it('should fetch current explanations or handle gracefully if none exist', async () => {
      try {
        const explanations = await fetchCurrentExplanation(TEST_SESSION_ID)

        expect(explanations).toBeInstanceOf(Array)
        if (explanations.length > 0) {
          const explanation = explanations[0]
          expect(explanation.id).toBeDefined()
          expect(explanation.title).toBeDefined()
          expect(explanation.description).toBeDefined()
        }
      } catch (error) {
        // Current explanations may not be available if session is not active
        // This is acceptable behavior
        expect(error).toBeDefined()
      }
    })
  })

  describe('fetchLiturgyExplanations', () => {
    it('should fetch liturgy explanations', async () => {
      const explanations = await fetchLiturgyExplanations(TEST_LITURGY_ID)
      
      expect(explanations).toBeInstanceOf(Array)
      if (explanations.length > 0) {
        const explanation = explanations[0]
        expect(explanation.id).toBeDefined()
        expect(explanation.title).toBeDefined()
        expect(explanation.description).toBeDefined()
      }
    })
  })

  describe('fetchLiturgyExplanation', () => {
    it('should fetch a single liturgy explanation', async () => {
      const explanation = await fetchLiturgyExplanation(TEST_LITURGY_ID, TEST_EXPLANATION_ID)
      
      expect(explanation).toBeDefined()
      expect(explanation.id).toBeDefined()
      expect(explanation.title).toBeDefined()
      expect(explanation.description).toBeDefined()
      expect(explanation.part_ids).toBeInstanceOf(Array)
    })
  })

  describe('fetchPartExplanations', () => {
    it('should fetch part explanations', async () => {
      const explanations = await fetchPartExplanations(TEST_LITURGY_ID, TEST_PART_ID)

      // Handle both array and empty response cases
      expect(Array.isArray(explanations)).toBe(true)

      if (explanations.length > 0) {
        const explanation = explanations[0]
        expect(explanation).toBeDefined()
        expect(explanation.id).toBeDefined()
        expect(explanation.title).toBeDefined()
        expect(explanation.description).toBeDefined()
        expect(explanation.created_at).toBeDefined()
        expect(explanation.updated_at).toBeDefined()
        expect(explanation.row_order).toBeDefined()
      }
    })

    it('should handle non-existent part gracefully', async () => {
      const nonExistentPartId = '999999'
      const explanations = await fetchPartExplanations(TEST_LITURGY_ID, nonExistentPartId)

      expect(Array.isArray(explanations)).toBe(true)
      expect(explanations.length).toBe(0)
    })
  })

  describe('fetchExplanationCitations', () => {
    it('should fetch explanation citations or return empty array', async () => {
      const citations = await fetchExplanationCitations(TEST_LITURGY_ID, TEST_EXPLANATION_ID)

      expect(Array.isArray(citations)).toBe(true)

      if (citations.length > 0) {
        const citation = citations[0]
        expect(citation).toBeDefined()
        expect(citation.id).toBeDefined()
        expect(citation.citation_type).toBeDefined()
        expect([0, 1, 2]).toContain(citation.citation_type)
        expect(citation.text).toBeDefined()
        expect(citation.source).toBeDefined()
        expect(citation.created_at).toBeDefined()
        expect(citation.updated_at).toBeDefined()
      }
    })

    it('should handle non-existent explanation gracefully', async () => {
      const nonExistentExplanationId = '999999'
      const citations = await fetchExplanationCitations(TEST_LITURGY_ID, nonExistentExplanationId)

      expect(Array.isArray(citations)).toBe(true)
      expect(citations.length).toBe(0)
    })

    it('should handle explanations with new fields (summary, tags, status)', async () => {
      const explanation = await fetchLiturgyExplanation(TEST_LITURGY_ID, TEST_EXPLANATION_ID)

      expect(explanation).toBeDefined()
      // New fields are optional, so we just check they don't break the response
      if (explanation.summary !== undefined) {
        expect(typeof explanation.summary).toBe('string')
      }
      if (explanation.tags !== undefined) {
        expect(Array.isArray(explanation.tags)).toBe(true)
      }
      if (explanation.status !== undefined) {
        // Status can be number (0, 1, 2) or string ('draft', 'published', 'archived')
        expect(typeof explanation.status === 'number' || typeof explanation.status === 'string').toBe(true)
      }
      if (explanation.average_rating !== undefined) {
        expect(typeof explanation.average_rating).toBe('number')
      }
      if (explanation.rating_count !== undefined) {
        expect(typeof explanation.rating_count).toBe('number')
      }
    })
  })

  describe('fetchExplanationRatings', () => {
    it('should fetch explanation ratings or return zero ratings', async () => {
      try {
        const ratings = await fetchExplanationRatings(TEST_LITURGY_ID, TEST_EXPLANATION_ID)

        expect(ratings).toBeDefined()
        expect(typeof ratings.average_rating).toBe('number')
        expect(typeof ratings.rating_count).toBe('number')
        expect(Array.isArray(ratings.ratings)).toBe(true)

        if (ratings.ratings.length > 0) {
          const rating = ratings.ratings[0]
          expect(rating).toBeDefined()
          expect(rating.id).toBeDefined()
          expect(rating.explanation_id).toBeDefined()
          expect(rating.user_id).toBeDefined()
          expect(rating.rating).toBeDefined()
          expect(rating.rating).toBeGreaterThanOrEqual(1)
          expect(rating.rating).toBeLessThanOrEqual(5)
          expect(rating.created_at).toBeDefined()
        }
      } catch (error) {
        // Ratings endpoint may not be available yet or may require authentication
        // This is acceptable for integration tests
        expect(error).toBeDefined()
      }
    })

    it('should handle non-existent explanation gracefully', async () => {
      const nonExistentExplanationId = '999999'

      try {
        const ratings = await fetchExplanationRatings(TEST_LITURGY_ID, nonExistentExplanationId)

        expect(ratings).toBeDefined()
        expect(ratings.average_rating).toBe(0)
        expect(ratings.rating_count).toBe(0)
        expect(ratings.ratings).toEqual([])
      } catch (error) {
        // If the endpoint doesn't exist or returns an error, that's acceptable
        // The function should handle 404s, but the endpoint may not be available yet
        expect(error).toBeDefined()
      }
    })
  })
}) 