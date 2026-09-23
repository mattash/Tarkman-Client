import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { sessionsKeys } from '../sessions'
import {
  acceptCommandPublication,
  fetchSessionState,
  normalizeSessionState,
  parseSessionPublication,
  publicationResult,
} from '../sessionState'
import type { PartsResponse } from '@/types/part'
import type { SessionWrapper } from '@/types/session'

vi.mock('@/api', () => ({ api: { get: vi.fn() } }))

const publication = {
  id: 7,
  revision: 11,
  content_context: 'aaaa000000000000',
  cursor: { part_id: 5, liturgy_part_id: 105, liturgy_id: 1, position: 3 },
  session_status: 'active',
  status_message: null,
  posture: 'stand',
  date: '2026-09-22',
}

const session: SessionWrapper = {
  session: {
    id: 7, liturgy: 'Fixture', liturgy_id: 1, date: '2026-09-22', church_name: 'Fixture', church_avatar: '',
    occupied: true, num_of_parts: 1, current_part_position: 2, current_part_id: 4, current_liturgy_part_id: 104,
    current_liturgy_id: 1, revision: 10, content_context: 'aaaa000000000000', page: 1, posture: null, readings: { gospel: '', epistle: '' },
    options: { gospel: '', epistle: '', before_message: '', after_message: '' }, status: 'active', status_message: null,
  },
}

const parts: PartsResponse = {
  parts: [{ part: {
    id: 5, liturgy_part_id: 105, liturgy_id: 1, position: 3, role: 'Reader', grabar: '', translit: '', en: '', ru: null,
    hy_east: null, hy_west: null, posture: null, sheet_music: null, duration_type: 'default', page: 8,
    explanation_ids: [], effective_duration_ms: 1000,
  } }],
  sessionData: session,
}

describe('session state contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes endpoint and command publication status fields', () => {
    expect(normalizeSessionState({ session: { ...publication, status: 'paused', session_status: undefined } })).toMatchObject({
      id: 7, revision: 11, status: 'paused', contentContext: 'aaaa000000000000',
      cursor: { partId: 5, liturgyPartId: 105, liturgyId: 1, position: 3 },
    })
    expect(parseSessionPublication(publication, 7)?.status).toBe('active')
    expect(parseSessionPublication({ ...publication, cursor: { part_id: 5 } }, 7)).toBeNull()
  })

  it('treats only 404/405 as an optional legacy state endpoint', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(Object.assign(new Error('missing'), { isAxiosError: true, response: { status: 404 } }))
    await expect(fetchSessionState('7')).resolves.toBeNull()
    vi.mocked(api.get).mockRejectedValueOnce(Object.assign(new Error('failed'), { isAxiosError: true, response: { status: 500 } }))
    await expect(fetchSessionState('7')).rejects.toThrow('failed')
  })

  it('applies only a matching contiguous revision', () => {
    const state = parseSessionPublication(publication, 7)!
    expect(publicationResult(10, state.contentContext, state)).toBe('applied')
    expect(publicationResult(11, state.contentContext, state)).toBe('duplicate')
    expect(publicationResult(11, 'different', state)).toBe('recover')
    expect(publicationResult(12, state.contentContext, state)).toBe('duplicate')
    expect(publicationResult(9, state.contentContext, state)).toBe('recover')
    expect(publicationResult(10, 'different', state)).toBe('recover')
  })

  it('accepts a complete command ack without invalidating the manifest', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(sessionsKeys.session('7'), session)
    queryClient.setQueryData(sessionsKeys.sessionParts('7'), parts)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    expect(acceptCommandPublication(queryClient, '7', publication)).toBe(true)
    expect(queryClient.getQueryData<SessionWrapper>(sessionsKeys.session('7'))?.session).toMatchObject({
      revision: 11, current_part_id: 5, current_liturgy_part_id: 105, page: 8,
    })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('refuses an ack for an unknown occurrence so recovery can refresh content', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(sessionsKeys.session('7'), session)
    queryClient.setQueryData(sessionsKeys.sessionParts('7'), parts)
    expect(acceptCommandPublication(queryClient, '7', {
      ...publication,
      cursor: { ...publication.cursor, liturgy_part_id: 999 },
    })).toBe(false)
  })
})
