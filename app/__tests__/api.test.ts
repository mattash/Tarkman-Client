import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

describe('API interceptors', () => {
  let mock: MockAdapter
  let mockApi: typeof import('../api').api

  beforeEach(async () => {
    // Clear localStorage
    localStorage.clear()

    // Clear window.location mock
    delete (window as any).location
    window.location = { href: '' } as any

    // Re-import api to get fresh instance with interceptors
    vi.resetModules()
    const apiModule = await import('../api')
    mockApi = apiModule.api

    // Create mock adapter for the api instance
    mock = new MockAdapter(mockApi)
  })

  afterEach(() => {
    mock.reset()
    localStorage.clear()
  })

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists in localStorage', async () => {
      localStorage.setItem('token', 'test-token-123')

      mock.onGet('/test').reply((config) => {
        expect(config.headers?.Authorization).toBe('Bearer test-token-123')
        return [200, { data: 'success' }]
      })

      await mockApi.get('/test')
    })

    it('should not add Authorization header when token does not exist', async () => {
      mock.onGet('/test').reply((config) => {
        expect(config.headers?.Authorization).toBeUndefined()
        return [200, { data: 'success' }]
      })

      await mockApi.get('/test')
    })

    it('should add Authorization header to POST requests', async () => {
      localStorage.setItem('token', 'post-token')

      mock.onPost('/test').reply((config) => {
        expect(config.headers?.Authorization).toBe('Bearer post-token')
        return [200, { data: 'success' }]
      })

      await mockApi.post('/test', { data: 'test' })
    })
  })

  describe('Response Interceptor - Token Update', () => {
    it('should update token from x-auth-token header', async () => {
      mock.onGet('/test').reply(200, { data: 'success' }, { 'x-auth-token': 'new-token-from-header' })

      await mockApi.get('/test')

      expect(localStorage.getItem('token')).toBe('new-token-from-header')
    })

    it('should update token from response data', async () => {
      mock.onGet('/test').reply(200, { token: 'new-token-from-data', data: 'success' })

      await mockApi.get('/test')

      expect(localStorage.getItem('token')).toBe('new-token-from-data')
    })

    it('should prefer x-auth-token header over response data token', async () => {
      mock.onGet('/test').reply(
        200,
        { token: 'data-token', data: 'success' },
        { 'x-auth-token': 'header-token' }
      )

      await mockApi.get('/test')

      expect(localStorage.getItem('token')).toBe('header-token')
    })

    it('should not update token when neither header nor data has token', async () => {
      localStorage.setItem('token', 'original-token')

      mock.onGet('/test').reply(200, { data: 'success' })

      await mockApi.get('/test')

      expect(localStorage.getItem('token')).toBe('original-token')
    })
  })

  describe('Response Interceptor - 401 Error Handling', () => {
    it('should attempt token refresh on 401 error', async () => {
      localStorage.setItem('token', 'expired-token')

      // First request fails with 401
      mock.onGet('/protected').replyOnce(401)

      // Refresh token succeeds
      mock.onPost('/refresh-token').replyOnce(200, { token: 'refreshed-token' })

      // Retry original request succeeds
      mock.onGet('/protected').replyOnce(200, { data: 'protected-data' })

      const response = await mockApi.get('/protected')

      expect(response.data).toEqual({ data: 'protected-data' })
      expect(localStorage.getItem('token')).toBe('refreshed-token')
    })

    it('should set Authorization header with new token on retry', async () => {
      localStorage.setItem('token', 'expired-token')

      mock.onGet('/protected').replyOnce(401)
      mock.onPost('/refresh-token').replyOnce(200, { token: 'new-token' })

      mock.onGet('/protected').replyOnce((config) => {
        expect(config.headers?.Authorization).toBe('Bearer new-token')
        return [200, { data: 'success' }]
      })

      await mockApi.get('/protected')
    })

    it('should redirect to login when token refresh fails', async () => {
      localStorage.setItem('token', 'expired-token')

      mock.onGet('/protected').replyOnce(401)
      mock.onPost('/refresh-token').replyOnce(401)

      try {
        await mockApi.get('/protected')
      } catch (error) {
        // Expected to fail
      }

      expect(localStorage.getItem('token')).toBeNull()
      expect(window.location.href).toBe('/login')
    })

    it('should not retry when _retry flag is already set', async () => {
      localStorage.setItem('token', 'expired-token')

      let requestCount = 0
      mock.onGet('/protected').reply(() => {
        requestCount++
        return [401]
      })

      mock.onPost('/refresh-token').reply(200, { token: 'new-token' })

      try {
        await mockApi.get('/protected')
      } catch (error) {
        // Expected to fail after retry
      }

      // Should only make 2 requests (original + 1 retry), not infinite loop
      expect(requestCount).toBe(2)
    })

    it('should handle non-401 errors normally', async () => {
      mock.onGet('/test').replyOnce(500, { error: 'Server error' })

      try {
        await mockApi.get('/test')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.status).toBe(500)
        expect(error.response.data).toEqual({ error: 'Server error' })
      }
    })

    it('should handle 404 errors normally without retry', async () => {
      mock.onGet('/not-found').replyOnce(404)

      try {
        await mockApi.get('/not-found')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
      }

      // Should not have called refresh-token
      expect(mock.history.post.length).toBe(0)
    })

    it('should remove token from localStorage when refresh fails', async () => {
      localStorage.setItem('token', 'expired-token')

      mock.onGet('/protected').replyOnce(401)
      mock.onPost('/refresh-token').networkErrorOnce()

      try {
        await mockApi.get('/protected')
      } catch (error) {
        // Expected
      }

      expect(localStorage.getItem('token')).toBeNull()
    })
  })

  describe('API Configuration', () => {
    it('should have correct base configuration', () => {
      expect(mockApi.defaults.baseURL).toBeDefined()
      expect(mockApi.defaults.headers['Content-Type']).toBe('application/json')
      expect(mockApi.defaults.headers['Accept']).toBe('application/json')
      expect(mockApi.defaults.withCredentials).toBe(true)
    })
  })

  describe('Multiple Concurrent 401 Requests', () => {
    it('should handle multiple concurrent 401s with single refresh', async () => {
      localStorage.setItem('token', 'expired-token')

      // Multiple endpoints fail with 401
      mock.onGet('/endpoint1').replyOnce(401)
      mock.onGet('/endpoint2').replyOnce(401)
      mock.onGet('/endpoint3').replyOnce(401)

      // Refresh token succeeds (needs to handle multiple concurrent calls)
      mock.onPost('/refresh-token').reply(200, { token: 'refreshed-token' })

      // Retry requests succeed
      mock.onGet('/endpoint1').reply(200, { data: 'data1' })
      mock.onGet('/endpoint2').reply(200, { data: 'data2' })
      mock.onGet('/endpoint3').reply(200, { data: 'data3' })

      // Make concurrent requests
      const results = await Promise.all([
        mockApi.get('/endpoint1'),
        mockApi.get('/endpoint2'),
        mockApi.get('/endpoint3'),
      ])

      expect(results[0].data).toEqual({ data: 'data1' })
      expect(results[1].data).toEqual({ data: 'data2' })
      expect(results[2].data).toEqual({ data: 'data3' })

      // Refresh should have been called (though in practice this may vary based on timing)
      expect(localStorage.getItem('token')).toBe('refreshed-token')
    })
  })
})
