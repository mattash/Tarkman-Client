import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSessions, fetchSession, fetchSessionParts, setPart, prevPart, nextPart, updateSessionStatus, classifyControlFailure, controlFailureMessage, sessionsKeys } from '../sessions'
import { api } from '@/api'

// Mock api
vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn()
  }
}))

const mockSessionData = {
  id: 1,
  liturgy: 'Divine Liturgy',
  liturgy_id: 1,
  date: '2024-03-20',
  church_name: 'St. Mary',
  church_avatar: 'https://example.com/avatar.jpg',
  occupied: true,
  num_of_parts: 10,
  current_part_position: 5,
  current_part_id: 123,
  current_liturgy_id: 1,
  page: 1,
  posture: 'standing',
  readings: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28'
  },
  options: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
    before_message: 'Before message',
    after_message: 'After message'
  }
}

const mockPartsResponse = {
  parts: [
    {
      part: {
        id: 123,
        role: 'priest',
        grabar: 'Գրաբար',
        translit: 'Grabar',
        hy_east: 'Հայերեն',
        hy_west: 'Հայերէն',
        ru: 'Русский',
        en: 'English',
        explanation_ids: [1, 2, 3],
        effective_duration_ms: 300000,
        position: 1
      }
    }
  ]
}

describe('sessionQueries', () => {
  it('keeps live state, metadata and manifests on sibling cache keys', () => {
    expect(sessionsKeys.session('7')).toEqual(['sessions', 'session', '7'])
    expect(sessionsKeys.sessionParts('7')).toEqual(['sessions', 'sessionParts', '7'])
    expect(sessionsKeys.state('7')).toEqual(['sessions', 'sessionState', '7'])
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchSessions', () => {
    it('should fetch sessions successfully', async () => {
      const mockResponse = [{ session: mockSessionData }]
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await fetchSessions('UTC')
      expect(result).toEqual(mockResponse)
      expect(api.get).toHaveBeenCalledWith('/services.json', {
        params: {
          tz: 'UTC'
        }
      })
    })

    it('propagates the original error without logging it', async () => {
      const requestError = Object.assign(new Error('Request failed'), {
        config: {
          headers: {
            Authorization: 'Bearer fetch-sessions-test-token'
          }
        }
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(api.get).mockRejectedValueOnce(requestError)

      await expect(fetchSessions('UTC')).rejects.toBe(requestError)
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })

  describe('fetchSession', () => {
    it('should fetch a session successfully', async () => {
      const mockResponse = { session: mockSessionData }
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await fetchSession('1')

      expect(result).toEqual(mockResponse)
      expect(api.get).toHaveBeenCalledWith('/s/1.json')
    })

    it('propagates the original error without logging it', async () => {
      const requestError = Object.assign(new Error('Request failed'), {
        config: {
          headers: {
            Authorization: 'Bearer fetch-session-test-token'
          }
        }
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(api.get).mockRejectedValueOnce(requestError)

      await expect(fetchSession('1')).rejects.toBe(requestError)
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })

  describe('fetchSessionParts', () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    it('should fetch session parts successfully', async () => {
      const mockPartsData = { parts: mockPartsResponse.parts }
      const mockSessionResponse = { session: mockSessionData }

      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: mockSessionResponse })
        .mockResolvedValueOnce({ data: mockPartsData })

      const result = await fetchSessionParts('1')
      expect(result).toEqual({
        parts: mockPartsData.parts,
        sessionData: mockSessionResponse
      })
      expect(api.get).toHaveBeenCalledTimes(2)
      expect(api.get).toHaveBeenNthCalledWith(1, '/s/1.json')
      expect(api.get).toHaveBeenNthCalledWith(2, '/s/1/parts.json')
    })

    it('reuses known session data when fetching parts', async () => {
      const mockPartsData = { parts: mockPartsResponse.parts }
      const mockSessionResponse = { session: mockSessionData }
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockPartsData })

      const result = await fetchSessionParts('1', mockSessionResponse)

      expect(result).toEqual({
        parts: mockPartsData.parts,
        sessionData: mockSessionResponse
      })
      expect(api.get).toHaveBeenCalledOnce()
      expect(api.get).toHaveBeenCalledWith('/s/1/parts.json')
    })

    it('falls back to liturgy parts when session parts fail', async () => {
      const mockSessionResponse = { session: mockSessionData }
      const mockLiturgyParts = { parts: mockPartsResponse.parts }

      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: mockSessionResponse })
        .mockRejectedValueOnce(new Error('Session parts unavailable'))
        .mockResolvedValueOnce({ data: mockLiturgyParts })

      const result = await fetchSessionParts('1')
      expect(result).toEqual({
        parts: mockLiturgyParts.parts,
        sessionData: mockSessionResponse
      })
      expect(api.get).toHaveBeenCalledWith('/liturgies/1/parts.json')
    })

    it('should handle fetch error', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))
      await expect(fetchSessionParts('1')).rejects.toThrow('Failed to fetch session 1')
    })
  })

  describe('setPart', () => {
    it('should set part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 123 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await setPart('1', 123)
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/set_part.json', { part_id: 123, transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(setPart('1', 123)).rejects.toThrow('API error')
    })
  })

  describe('prevPart', () => {
    it('should go to previous part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 122 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await prevPart('1')
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/prev.json', { transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(prevPart('1')).rejects.toThrow('API error')
    })
  })

  describe('nextPart', () => {
    it('should go to next part successfully', async () => {
      const mockResponse = { status: 'success', current_part_id: 124 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await nextPart('1')
      expect(result).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/s/1/next.json', { transitioned_at: undefined })
    })

    it('should handle API error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))
      await expect(nextPart('1')).rejects.toThrow('API error')
    })
  })

  describe('updateSessionStatus', () => {
    it('should update status to paused successfully', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'paused' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'paused' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'paused' })
    })

    it('should update status with custom message', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'showing_custom' as const,
        status_message: 'Test announcement'
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', {
        status: 'showing_custom',
        status_message: 'Test announcement'
      })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', {
        status: 'showing_custom',
        status_message: 'Test announcement'
      })
    })

    it('should update status to showing_gospel', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'showing_gospel' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'showing_gospel' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'showing_gospel' })
    })

    it('should update status back to active', async () => {
      const mockResponse = {
        status: 'Session status updated',
        current_status: 'active' as const,
        status_message: null
      }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await updateSessionStatus('1', { status: 'active' })
      expect(result).toEqual(mockResponse)
      expect(api.patch).toHaveBeenCalledWith('/s/1/update_status.json', { status: 'active' })
    })

    it('should handle API error', async () => {
      vi.mocked(api.patch).mockRejectedValueOnce(new Error('Unauthorized'))
      await expect(updateSessionStatus('1', { status: 'paused' })).rejects.toThrow('Unauthorized')
    })
  })
}) 

describe('stale-part guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the part this client believes the service is on', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'ok', current_part_id: 124 } })
    await nextPart('1', '2026-09-12T00:00:00.000Z', 123)
    await prevPart('1', '2026-09-12T00:00:00.000Z', 123)
    await setPart('1', 52, '2026-09-12T00:00:00.000Z', 123)
    for (const call of vi.mocked(api.post).mock.calls) {
      expect(call[1]).toMatchObject({ expected_part_id: 123 })
    }
    expect(vi.mocked(api.post).mock.calls[2][1]).toMatchObject({ part_id: 52 })
  })

  it('omits the guard when this client does not know the current part', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'ok', current_part_id: 124 } })
    await nextPart('1', '2026-09-12T00:00:00.000Z', null)
    await prevPart('1')
    for (const call of vi.mocked(api.post).mock.calls) {
      expect(call[1]).not.toHaveProperty('expected_part_id')
    }
  })
})

describe('control failures', () => {
  const axiosError = (status: number, data: unknown) =>
    Object.assign(new Error('request failed'), { isAxiosError: true, response: { status, data } })

  it('tells a stale move apart from a refusal, an ended sign-in and anything else', () => {
    expect(classifyControlFailure(axiosError(409, { error: 'The current part changed', current_part_id: 77 })))
      .toEqual({ kind: 'stale', currentPartId: 77 })
    expect(classifyControlFailure(axiosError(409, {}))).toEqual({ kind: 'stale', currentPartId: null })
    expect(classifyControlFailure(axiosError(403, {}))).toEqual({ kind: 'forbidden' })
    expect(classifyControlFailure(axiosError(401, {}))).toEqual({ kind: 'unauthenticated' })
    expect(classifyControlFailure(axiosError(500, {}))).toEqual({ kind: 'other' })
    expect(classifyControlFailure(new Error('network down'))).toEqual({ kind: 'other' })
  })

  it('explains each failure in words an operator can act on', () => {
    expect(controlFailureMessage({ kind: 'stale', currentPartId: 77 }, 'position')).toMatch(/moved on somewhere else/)
    expect(controlFailureMessage({ kind: 'forbidden' }, 'position')).toMatch(/do not have permission/)
    expect(controlFailureMessage({ kind: 'unauthenticated' }, 'position')).toMatch(/sign-in has ended/)
    expect(controlFailureMessage({ kind: 'other' }, 'position')).toMatch(/position could not be updated/)
    expect(controlFailureMessage({ kind: 'other' }, 'status')).toMatch(/status could not be updated/)
  })

  it('names the end of the service a refused move ran into', () => {
    expect(classifyControlFailure(axiosError(422, { status: 'Could not advance session', current_part_id: 334 })))
      .toEqual({ kind: 'boundary', direction: 'next' })
    expect(classifyControlFailure(axiosError(422, { status: 'Could not back session' })))
      .toEqual({ kind: 'boundary', direction: 'previous' })
    expect(classifyControlFailure(axiosError(422, { error: 'Status cannot change now' }))).toEqual({ kind: 'other' })
    expect(controlFailureMessage({ kind: 'boundary', direction: 'next' }, 'position'))
      .toBe('This is the last part. There is nothing after it.')
    expect(controlFailureMessage({ kind: 'boundary', direction: 'previous' }, 'position'))
      .toBe('This is the first part. There is nothing before it.')
  })
})
