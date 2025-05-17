import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fetchSessions, fetchSessionParts, setPart, prevPart, nextPart } from '../sessions'
import { login } from '../../api/auth'
import { SessionWrapper } from '../../types/session'
import { Part } from '../../types/part'
import { api } from '../../api'

// These values should be updated with real data from your API
const TEST_SESSION_ID = '2551'
const TEST_PART_ID = 15

// Test credentials from environment variables
const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD || 'password'

describe('sessionQueries integration tests', () => {
  beforeAll(async () => {
    // Verify that we have the required environment variables
    if (!import.meta.env.VITE_API_URL) {
      throw new Error('VITE_API_URL environment variable is required for integration tests')
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
      console.log('Successfully authenticated')
    } catch (error) {
      console.error('Failed to authenticate:', error)
      throw new Error('Authentication required for integration tests')
    }
  })

  afterAll(() => {
    // Clean up
    localStorage.removeItem('token')
  })

  describe('fetchSessions', () => {
    it('should fetch sessions', async () => {
      try {
        const sessions = await fetchSessions()
        console.log('Raw sessions response:', sessions)
        
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
        console.log('Session parts response:', response)
        
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

  describe('setPart', () => {
    it('should set part', async () => {
      try {
        const response = await setPart(TEST_SESSION_ID, TEST_PART_ID)
        console.log('Set part response:', response)
        
        expect(response.status).toBeDefined()
        expect(response.current_part_id).toBeDefined()
        expect(typeof response.current_part_id).toBe('number')
      } catch (error) {
        console.error('Set part error:', error)
        throw error
      }
    })
  })

  describe('prevPart', () => {
    it('should go to previous part', async () => {
      try {
        const response = await prevPart(TEST_SESSION_ID)
        console.log('Prev part response:', response)
        
        expect(response.status).toBeDefined()
        expect(response.current_part_id).toBeDefined()
        expect(typeof response.current_part_id).toBe('number')
      } catch (error) {
        console.error('Prev part error:', error)
        throw error
      }
    })
  })

  describe('nextPart', () => {
    it('should go to next part', async () => {
      try {
        const response = await nextPart(TEST_SESSION_ID)
        console.log('Next part response:', response)
        
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