import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fetchSessions, fetchSessionParts, setPart, prevPart, nextPart } from '../sessions'
import { login } from '../../api/auth'
import { SessionWrapper } from '../../types/session'
import { Part } from '../../types/part'
import { api } from '../../api'

// Test credentials from environment variables
const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD || 'password'

// Test data - can be configured via environment variables
const TEST_SESSION_ID = import.meta.env.VITE_TEST_SESSION_ID || '10'
const TEST_PART_ID = 4

const shouldSkipIntegrationTests = !import.meta.env.VITE_TEST_EMAIL || !import.meta.env.VITE_TEST_PASSWORD

// Integration tests - will skip if credentials not provided
describe.skipIf(shouldSkipIntegrationTests)('sessionQueries integration tests', () => {
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

  describe('fetchSessions', () => {
    it('should fetch sessions', async () => {
      try {
        const sessions = await fetchSessions('UTC')
        
        expect(sessions).toBeDefined()
        expect(Array.isArray(sessions)).toBe(true)
        if (sessions.length > 0) {
          const session = sessions[0].session
          expect(session.id).toBeDefined()
          expect(session.liturgy).toBeDefined()
          expect(session.date).toBeDefined()
          expect(session.church_name).toBeDefined()
          expect(session.occupied).toBeDefined()
          expect(session.num_of_parts).toBeDefined()
          expect(session.current_part_position).toBeDefined()
          expect(session.current_part_id).toBeDefined()
          expect(session.page).toBeDefined()
          expect(session.readings).toBeDefined()
          expect(session.options).toBeDefined()
        }
      } catch (error) {
        console.error('Error in fetchSessions test:', error)
        throw error
      }
    })
  })

  describe('fetchSessionParts', () => {
    it('should fetch session parts', async () => {
      try {
        const response = await fetchSessionParts(TEST_SESSION_ID)
        
        expect(response.parts).toBeDefined()
        expect(Array.isArray(response.parts)).toBe(true)
        expect(response.sessionData).toBeDefined()
        expect(response.sessionData.session).toBeDefined()
        
        if (response.parts.length > 0) {
          const part = response.parts[0].part
          expect(part.id).toBeDefined()
          expect(part.role).toBeDefined()
          expect(part.grabar).toBeDefined()
          expect(part.translit).toBeDefined()
          expect(part.hy_east).toBeDefined()
          expect(part.hy_west).toBeDefined()
          expect(part.ru).toBeDefined()
          expect(part.en).toBeDefined()
          expect(part.explanation_ids).toBeInstanceOf(Array)
          expect(part.effective_duration_ms).toBeDefined()
          expect(part.position).toBeDefined()
        }
      } catch (error) {
        console.error('Error in fetchSessionParts test:', error)
        throw error
      }
    })
  })

  // These tests require an active session with admin control permissions
  // They need a live, occupied session that you have admin control over
  // To run these tests, start a live session and use its ID in VITE_TEST_SESSION_ID
  describe.skip('setPart', () => {
    it('should set part', async () => {
      try {
        const response = await setPart(TEST_SESSION_ID, TEST_PART_ID)

        expect(response.status).toBeDefined()
        expect(response.current_part_id).toBeDefined()
        expect(typeof response.current_part_id).toBe('number')
      } catch (error) {
        console.error('Set part error:', error)
        throw error
      }
    })
  })

  describe.skip('prevPart', () => {
    it('should go to previous part', async () => {
      try {
        const response = await prevPart(TEST_SESSION_ID)

        expect(response.status).toBeDefined()
        expect(response.current_part_id).toBeDefined()
        expect(typeof response.current_part_id).toBe('number')
      } catch (error) {
        console.error('Prev part error:', error)
        throw error
      }
    })
  })

  describe.skip('nextPart', () => {
    it('should go to next part', async () => {
      try {
        const response = await nextPart(TEST_SESSION_ID)

        expect(response.status).toBeDefined()
        expect(response.current_part_id).toBeDefined()
        expect(typeof response.current_part_id).toBe('number')
      } catch (error) {
        console.error('Next part error:', error)
        throw error
      }
    })
  })
}) 