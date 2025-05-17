import { describe, it, expect, beforeAll } from 'vitest'
import {
  fetchExplanation,
  fetchCurrentExplanation,
  fetchLiturgyExplanations,
  fetchLiturgyExplanation,
  fetchPartExplanations
} from '../explanationQueries'

// These values should be updated with real data from your API
const TEST_SESSION_ID = '2551'
const TEST_LITURGY_ID = '1'
const TEST_PART_ID = '15'
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
    it('should fetch current explanations', async () => {
      const explanations = await fetchCurrentExplanation(TEST_SESSION_ID)
      
      expect(explanations).toBeInstanceOf(Array)
      if (explanations.length > 0) {
        const explanation = explanations[0]
        expect(explanation.id).toBeDefined()
        expect(explanation.title).toBeDefined()
        expect(explanation.description).toBeDefined()
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
}) 