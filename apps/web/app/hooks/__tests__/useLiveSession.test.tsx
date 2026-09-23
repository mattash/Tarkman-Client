import { act, render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveSession } from '../useLiveSession'
import type { ActionCableMessage, ActionCableState } from '../useActionCable'
import type { PartsResponse } from '@/types/part'
import type { SessionWrapper } from '@/types/session'
import { dispatchSessionPublication, type SessionState } from '@/queries/sessionState'

vi.mock('../useActionCable', () => ({ useActionCableState: vi.fn() }))
vi.mock('@/queries/sessions', async () => ({
  ...(await vi.importActual<typeof import('@/queries/sessions')>('@/queries/sessions')),
  fetchSession: vi.fn(),
  fetchSessionParts: vi.fn(),
}))
vi.mock('@/queries/sessionState', async () => ({
  ...(await vi.importActual<typeof import('@/queries/sessionState')>('@/queries/sessionState')),
  fetchSessionState: vi.fn(),
}))
vi.mock('../smoothScrollToPart', () => ({ smoothScrollToPart: vi.fn() }))

import { useActionCableState } from '../useActionCable'
import { fetchSession, fetchSessionParts } from '@/queries/sessions'
import { fetchSessionState } from '@/queries/sessionState'
import { smoothScrollToPart } from '../smoothScrollToPart'

function state(revision: number, occurrence = 101, context = 'aaaa000000000000', status: SessionState['status'] = 'active'): SessionState {
  return {
    id: 7, revision, contentContext: context,
    cursor: { partId: occurrence === 102 ? 5 : occurrence === 103 ? 6 : 4, liturgyPartId: occurrence, liturgyId: 1, position: occurrence - 100 },
    status, message: status === 'paused' ? 'Pause' : null, posture: 'stand', date: '2026-09-22',
  }
}

const initialSession: SessionWrapper = {
  session: {
    id: 7, liturgy: 'Fixture', liturgy_id: 1, date: '2026-09-22', church_name: 'Fixture', church_avatar: '', occupied: true,
    num_of_parts: 3, current_part_position: 1, current_part_id: 4, current_liturgy_part_id: 101, current_liturgy_id: 1,
    revision: 10, page: 1, posture: 'stand', readings: { gospel: '', epistle: '' },
    options: { gospel: '', epistle: '', before_message: '', after_message: '' }, status: 'active', status_message: null,
  },
}

function parts(contextSession = initialSession): PartsResponse {
  const base = {
    role: 'Reader', grabar: '', translit: '', en: '', ru: null, hy_east: null, hy_west: null, posture: null,
    sheet_music: null, duration_type: 'default' as const, explanation_ids: [] as number[], effective_duration_ms: 5000,
  }
  return {
    parts: [
      { part: { ...base, id: 4, liturgy_part_id: 101, liturgy_id: 1, position: 1, page: 1 } },
      { part: { ...base, id: 5, liturgy_part_id: 102, liturgy_id: 1, position: 2, page: 2 } },
      { part: { ...base, id: 6, liturgy_part_id: 103, liturgy_id: 1, position: 3, page: 3 } },
    ],
    sessionData: contextSession,
  }
}

function publication(value: SessionState): ActionCableMessage {
  return {
    session: value.id, revision: value.revision, content_context: value.contentContext,
    cursor: value.cursor ? {
      part_id: value.cursor.partId, liturgy_part_id: value.cursor.liturgyPartId,
      liturgy_id: value.cursor.liturgyId, position: value.cursor.position,
    } : null,
    session_status: value.status, status_message: value.message, posture: value.posture, date: value.date,
  }
}

function wrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useLiveSession', () => {
  let cable: ActionCableState

  beforeEach(() => {
    vi.clearAllMocks()
    cable = { message: null, connected: false }
    vi.mocked(useActionCableState).mockImplementation(() => cable)
    vi.mocked(fetchSession).mockResolvedValue(initialSession)
    vi.mocked(fetchSessionParts).mockResolvedValue(parts())
    vi.mocked(fetchSessionState).mockResolvedValue(state(10))
  })

  it('applies contiguous socket updates once without state or manifest GETs', async () => {
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()

    cable = { message: publication(state(11, 102)), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    expect(fetchSessionState).not.toHaveBeenCalled()
    expect(fetchSessionParts).not.toHaveBeenCalled()

    rerender()
    expect(result.current.currentPartKey).toBe('lp:102')
    expect(fetchSessionState).not.toHaveBeenCalled()
  })

  it('does not verify a contiguous connected publication before the 30-second safety poll', async () => {
    vi.useFakeTimers()
    try {
      cable = { message: null, connected: true }
      const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(result.current.currentPartKey).toBe('lp:101')
      vi.clearAllMocks()

      cable = { message: publication(state(11, 102)), connected: true }
      rerender()
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(result.current.currentPartKey).toBe('lp:102')
      expect(fetchSessionState).not.toHaveBeenCalled()
      expect(fetchSession).not.toHaveBeenCalled()
      expect(fetchSessionParts).not.toHaveBeenCalled()

      await act(async () => { await vi.advanceTimersByTimeAsync(29000) })
      expect(fetchSessionState).toHaveBeenCalledTimes(1)
      expect(fetchSession).not.toHaveBeenCalled()
      expect(fetchSessionParts).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores an older out-of-order publication without rewinding', async () => {
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    cable = { message: publication(state(11, 102)), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    vi.clearAllMocks()
    cable = { message: publication(state(10, 101)), connected: false }
    rerender()
    expect(result.current.currentPartKey).toBe('lp:102')
    expect(fetchSessionState).not.toHaveBeenCalled()
  })

  it('deduplicates acknowledgment/socket ordering and does not restart scrolling', async () => {
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    const element = document.createElement('div')
    result.current.partsRef.current['lp:102'] = element
    vi.mocked(smoothScrollToPart).mockClear()
    const update = state(11, 102)

    act(() => { dispatchSessionPublication('7', publication(update)) })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    cable = { message: publication(update), connected: false }
    rerender()
    expect(smoothScrollToPart).toHaveBeenCalledTimes(1)
  })

  it('also deduplicates socket-first then acknowledgment ordering', async () => {
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    const element = document.createElement('div')
    result.current.partsRef.current['lp:102'] = element
    vi.mocked(smoothScrollToPart).mockClear()
    const update = state(11, 102)
    cable = { message: publication(update), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    act(() => { dispatchSessionPublication('7', publication(update)) })
    expect(smoothScrollToPart).toHaveBeenCalledTimes(1)
  })

  it('recovers a deliberately missed revision through one lightweight state read', async () => {
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()
    vi.mocked(fetchSessionState).mockResolvedValue(state(12, 103))

    cable = { message: publication(state(12, 103)), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:103'))
    expect(fetchSessionState).toHaveBeenCalledTimes(1)
    expect(fetchSessionParts).not.toHaveBeenCalled()
  })

  it('quietly supersedes an in-flight recovery when a newer contiguous publication arrives', async () => {
    cable = { message: null, connected: true }
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    await waitFor(() => expect(result.current.connectionState).toBe('connected'))
    vi.clearAllMocks()
    let resolvePending: (value: SessionState) => void = () => {}
    vi.mocked(fetchSessionState)
      .mockReturnValueOnce(new Promise(resolve => { resolvePending = resolve }))
      .mockResolvedValue(state(11, 102))

    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(fetchSessionState).toHaveBeenCalledTimes(1))
    cable = { message: publication(state(11, 102)), connected: true }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    act(() => resolvePending(state(10, 101)))

    await waitFor(() => expect(result.current.connectionState).toBe('connected'))
    expect(result.current.error).toBeNull()
    expect(result.current.currentPartKey).toBe('lp:102')
    expect(fetchSessionParts).not.toHaveBeenCalled()
  })

  it('refreshes the manifest exactly once when content context changes', async () => {
    const changedSession = { ...initialSession, session: { ...initialSession.session, revision: 11 } }
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()
    vi.mocked(fetchSessionState).mockResolvedValue(state(11, 102, 'bbbb111111111111'))
    vi.mocked(fetchSession).mockResolvedValue(changedSession)
    vi.mocked(fetchSessionParts).mockResolvedValue(parts(changedSession))

    cable = { message: publication(state(11, 102, 'bbbb111111111111')), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    expect(fetchSessionParts).toHaveBeenCalledTimes(1)
    expect(fetchSessionState).toHaveBeenCalledTimes(2)
  })

  it('discards a manifest when bracketed state reads observe a content change', async () => {
    const changedSession = { ...initialSession, session: { ...initialSession.session, revision: 12 } }
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()
    vi.mocked(fetchSession).mockResolvedValue(changedSession)
    vi.mocked(fetchSessionParts).mockResolvedValue(parts(changedSession))
    vi.mocked(fetchSessionState)
      .mockResolvedValueOnce(state(11, 102, 'bbbb111111111111'))
      .mockResolvedValueOnce(state(12, 103, 'cccc222222222222'))
      .mockResolvedValue(state(12, 103, 'cccc222222222222'))

    cable = { message: publication(state(11, 102, 'bbbb111111111111')), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:103'))
    expect(fetchSessionParts).toHaveBeenCalledTimes(2)
    expect(result.current.sessionData.session.content_context).toBe('cccc222222222222')
  })

  it('refreshes once for an unknown exact occurrence instead of selecting a repeated Part', async () => {
    const repeated = parts()
    repeated.parts[1].part.id = 4
    vi.mocked(fetchSessionParts).mockResolvedValueOnce(repeated)
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()
    const recovered = parts()
    recovered.parts.push({ part: { ...recovered.parts[0].part, liturgy_part_id: 199, position: 4 } })
    vi.mocked(fetchSessionParts).mockResolvedValue(recovered)
    vi.mocked(fetchSessionState).mockResolvedValue({ ...state(11), cursor: { partId: 4, liturgyPartId: 199, liturgyId: 1, position: 4 } })

    cable = { message: publication({ ...state(11), cursor: { partId: 4, liturgyPartId: 199, liturgyId: 1, position: 4 } }), connected: false }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:199'))
    expect(fetchSessionParts).toHaveBeenCalledTimes(1)
  })

  it('recovers on reconnect and refuses a stale state response that would rewind', async () => {
    cable = { message: null, connected: true }
    const { result, rerender } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    cable = { message: publication(state(11, 102)), connected: true }
    rerender()
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    cable = { message: cable.message, connected: false }
    rerender()
    vi.clearAllMocks()
    vi.mocked(fetchSessionState).mockResolvedValue(state(10, 101))

    cable = { message: cable.message, connected: true }
    rerender()
    await waitFor(() => expect(result.current.error?.message).toContain('stale'))
    expect(result.current.currentPartKey).toBe('lp:102')
  })

  it('recovers a missed update when the window regains focus', async () => {
    const { result } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    vi.clearAllMocks()
    vi.mocked(fetchSessionState).mockResolvedValue(state(11, 102))
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:102'))
    expect(fetchSessionParts).not.toHaveBeenCalled()
  })

  it('falls back to canonical session recovery when state.json is unavailable', async () => {
    vi.mocked(fetchSessionState).mockResolvedValue(null)
    const { result } = renderHook(() => useLiveSession('7', initialSession), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.currentPartKey).toBe('lp:101'))
    expect(fetchSession).toHaveBeenCalled()
    expect(fetchSessionParts).toHaveBeenCalledTimes(1)
  })

  it('discards a late recovery response after switching sessions', async () => {
    let resolveFirst: (value: SessionState) => void = () => {}
    vi.mocked(fetchSessionState).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    const secondSession = { ...initialSession, session: { ...initialSession.session, id: 8, revision: 0 } }
    const secondState = { ...state(1), id: 8 }
    vi.mocked(fetchSessionState).mockResolvedValue(secondState)
    vi.mocked(fetchSession).mockResolvedValue(secondSession)
    vi.mocked(fetchSessionParts).mockResolvedValue(parts(secondSession))
    const { result, rerender } = renderHook(
      ({ id, session }) => useLiveSession(id, session),
      { initialProps: { id: '7', session: initialSession }, wrapper: wrapper() },
    )
    rerender({ id: '8', session: secondSession })
    resolveFirst(state(10))
    await waitFor(() => {
      expect(result.current.sessionData.session.id).toBe(8)
      expect(result.current.sessionData.session.revision).toBe(1)
    })
  })

  it('preserves new-session ref registration and scrolls to its occurrence', async () => {
    const secondSession = { ...initialSession, session: { ...initialSession.session,
      id: 8, revision: 0, current_part_id: 5, current_liturgy_part_id: 102, current_part_position: 2 } }
    const secondState = { ...state(1, 102), id: 8 }
    vi.mocked(fetchSessionState).mockImplementation(async id => id === '8' ? secondState : state(10))
    vi.mocked(fetchSession).mockImplementation(async id => id === '8' ? secondSession : initialSession)
    vi.mocked(fetchSessionParts).mockImplementation(async (_id, session) => parts(session ?? initialSession))

    function RefRegistrationProbe({ id, session }: { id: string; session: SessionWrapper }) {
      const live = useLiveSession(id, session)
      return <div ref={element => { if (element) live.partsRef.current['lp:102'] = element }} />
    }

    const view = render(<RefRegistrationProbe id="7" session={initialSession} />, { wrapper: wrapper() })
    await waitFor(() => expect(fetchSessionState).toHaveBeenCalledWith('7'))
    vi.mocked(smoothScrollToPart).mockClear()
    view.rerender(<RefRegistrationProbe id="8" session={secondSession} />)

    await waitFor(() => expect(smoothScrollToPart).toHaveBeenCalledTimes(1))
    expect(smoothScrollToPart).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(Object))
  })
})
