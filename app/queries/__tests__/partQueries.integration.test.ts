import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fetchPart } from '../partQueries'
import { login } from '../../api/auth'

// Test credentials from environment variables
const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD || 'password'

// Test data - can be configured via environment variables
const TEST_SESSION_ID = import.meta.env.VITE_TEST_SESSION_ID || '10'
const TEST_PART_ID = 4

const shouldSkipIntegrationTests = !import.meta.env.VITE_TEST_EMAIL || !import.meta.env.VITE_TEST_PASSWORD

// Integration tests - will skip if credentials not provided
describe.skipIf(shouldSkipIntegrationTests)('partQueries integration tests', () => {
  beforeAll(async () => {
    // Verify that we have the required environment variables
    if (!import.meta.env.VITE_API_URL) {
      throw new Error('VITE_API_URL environment variable is required for integration tests')
    }

    // Skip tests if credentials not provided
    if (!import.meta.env.VITE_TEST_EMAIL || !import.meta.env.VITE_TEST_PASSWORD) {
      console.warn('⚠️  Integration tests skipped: Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run')
      return
    }

    // Clear any existing token
    localStorage.removeItem('token')

    // Login to get authentication token
    try {
      const response = await login({ email: TEST_EMAIL, password: TEST_PASSWORD })
      if (!response.token) {
        throw new Error('No token received from login')
      }
      // Store token in localStorage (api.ts will pick this up)
      localStorage.setItem('token', response.token)
    } catch (error) {
      console.warn('⚠️  Integration tests skipped: Authentication failed')
    }
  })

  afterAll(() => {
    // Clean up
    localStorage.removeItem('token')
  })

  describe('fetchPart', () => {
    it('should fetch part details', async () => {
      try {
        const response = await fetchPart(TEST_SESSION_ID, TEST_PART_ID)
        
        expect(response.part).toBeDefined()
        expect(response.part.id).toBeDefined()
        expect(response.part.role).toBeDefined()
        expect(response.part.grabar).toBeDefined()
        expect(response.part.translit).toBeDefined()
        expect(response.part.hy_east).toBeDefined()
        expect(response.part.hy_west).toBeDefined()
        expect(response.part.ru).toBeDefined()
        expect(response.part.en).toBeDefined()
        expect(response.part.explanation_ids).toBeInstanceOf(Array)
        expect(response.part.effective_duration_ms).toBeDefined()
        expect(response.part.position).toBeDefined()
        expect(response.part.duration_type).toBeDefined()
        expect(response.part.page).toBeDefined()
        expect(response.part.posture).toBeDefined()
      } catch (error) {
        console.error('Error in fetchPart test:', error)
        throw error
      }
    })
  })
}) 