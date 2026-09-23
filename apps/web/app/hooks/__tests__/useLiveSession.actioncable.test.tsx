import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionWrapper } from '@/types/session'
import type { SessionState } from '@/queries/sessionState'
import { useLiveSession } from '../useLiveSession'
import { ExplanationIndicator } from '@/components/ExplanationIndicator'

interface CableHandlers {
  connected?: () => void
  disconnected?: () => void
  received?: (value: { event: string; data: Record<string, unknown> }) => void
}

let cableHandlers: CableHandlers | null = null
let subscriptionCount = 0

vi.mock('@rails/actioncable', () => ({
  createConsumer: vi.fn(() => ({
    subscriptions: {
      create: vi.fn((_identifier: unknown, handlers: CableHandlers) => {
        subscriptionCount += 1
        cableHandlers = handlers
        return { unsubscribe: vi.fn() }
      }),
    },
    disconnect: vi.fn(),
  })),
}))

vi.mock('@/queries/sessions', async () => ({
  ...(await vi.importActual<typeof import('@/queries/sessions')>('@/queries/sessions')),
  fetchSession: vi.fn(),
  fetchSessionParts: vi.fn(),
}))

vi.mock('@/queries/sessionState', async () => ({
  ...(await vi.importActual<typeof import('@/queries/sessionState')>('@/queries/sessionState')),
  fetchSessionState: vi.fn(),
}))

vi.mock('@/queries/explanationQueries', async () => ({
  ...(await vi.importActual<typeof import('@/queries/explanationQueries')>('@/queries/explanationQueries')),
  fetchCurrentExplanation: vi.fn(),
}))

vi.mock('../smoothScrollToPart', () => ({ smoothScrollToPart: vi.fn() }))

import { fetchSession, fetchSessionParts, sessionsKeys } from '@/queries/sessions'
import { fetchSessionState } from '@/queries/sessionState'
import { fetchCurrentExplanation } from '@/queries/explanationQueries'

const initialSession: SessionWrapper = {
  session: {
    id: 7, liturgy: 'Fixture', liturgy_id: 1, date: '2026-09-23', church_name: 'Fixture', church_avatar: '', occupied: true,
    num_of_parts: 2, current_part_position: 1, current_part_id: 4, current_liturgy_part_id: 101, current_liturgy_id: 1,
    revision: 10, page: 1, posture: 'stand', readings: { gospel: '', epistle: '' },
    options: { gospel: '', epistle: '', before_message: '', after_message: '' }, status: 'active', status_message: null,
  },
}

function state(revision: number, occurrence = 101): SessionState {
  return {
    id: 7, revision, contentContext: 'fixture-context',
    cursor: { partId: occurrence === 102 ? 5 : 4, liturgyPartId: occurrence, liturgyId: 1, position: occurrence - 100 },
    status: 'active', message: null, posture: 'stand', date: '2026-09-23',
  }
}

function publication(value: SessionState): Record<string, unknown> {
  return {
    id: String(value.id), session: String(value.id), revision: value.revision, content_context: value.contentContext,
    cursor: value.cursor && {
      part_id: value.cursor.partId, liturgy_part_id: value.cursor.liturgyPartId,
      liturgy_id: value.cursor.liturgyId, position: value.cursor.position,
    },
    session_status: value.status, status_message: value.message, posture: value.posture, date: value.date,
  }
}

const parts = {
  parts: [
    { part: { id: 4, liturgy_part_id: 101, liturgy_id: 1, position: 1, page: 1, role: 'Reader', grabar: '', translit: '', en: '', ru: null, hy_east: null, hy_west: null, posture: null, sheet_music: null, duration_type: 'default' as const, explanation_ids: [] as number[], effective_duration_ms: 5000 } },
    { part: { id: 5, liturgy_part_id: 102, liturgy_id: 1, position: 2, page: 2, role: 'Reader', grabar: '', translit: '', en: '', ru: null, hy_east: null, hy_west: null, posture: null, sheet_music: null, duration_type: 'default' as const, explanation_ids: [] as number[], effective_duration_ms: 5000 } },
  ],
  sessionData: initialSession,
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <StrictMode><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StrictMode>
  )
}

function SharedSubscriberProbe({ session = initialSession }: { session?: SessionWrapper }) {
  const live = useLiveSession('7', session)
  return (
    <>
      <output data-testid="reading">{live.currentPartKey}</output>
      <ExplanationIndicator sessionId="7" enabled />
    </>
  )
}

function RouteSubscriberProbe() {
  const { data = initialSession } = useQuery({
    queryKey: sessionsKeys.session('7'),
    queryFn: () => fetchSession('7'),
    initialData: initialSession,
    staleTime: Infinity,
  })
  return <SharedSubscriberProbe session={data} />
}

describe('useLiveSession with shared ActionCable subscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cableHandlers = null
    subscriptionCount = 0
    vi.mocked(fetchSession).mockResolvedValue(initialSession)
    vi.mocked(fetchSessionParts).mockResolvedValue(parts)
    vi.mocked(fetchSessionState).mockResolvedValue(state(10))
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])
  })

  it('does not verify an ordinary contiguous publication while already connected', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
    const view = render(<RouteSubscriberProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:101'))
    act(() => cableHandlers?.connected?.())
    await waitFor(() => expect(fetchCurrentExplanation).toHaveBeenCalledTimes(1))
    vi.mocked(fetchSessionState).mockClear()
    vi.mocked(fetchSession).mockClear()
    vi.mocked(fetchSessionParts).mockClear()
    vi.mocked(fetchCurrentExplanation).mockClear()
    const stableSubscriptionCount = subscriptionCount

    act(() => {
      cableHandlers?.received?.({ event: 'part_change', data: publication(state(11, 102)) })
    })

    await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:102'))
    await waitFor(() => expect(fetchCurrentExplanation).toHaveBeenCalledTimes(1))
    expect(subscriptionCount).toBe(stableSubscriptionCount)
    expect(fetchSessionState).not.toHaveBeenCalled()
    expect(fetchSession).not.toHaveBeenCalled()
    expect(fetchSessionParts).not.toHaveBeenCalled()
  })

  it('accepts a contiguous publication immediately after a completed safety recovery', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
      const view = render(<RouteSubscriberProbe />, { wrapper: wrapper(queryClient) })

      await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:101'))
      act(() => cableHandlers?.connected?.())
      vi.mocked(fetchSessionState).mockClear()
      await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
      await waitFor(() => expect(fetchSessionState).toHaveBeenCalledTimes(1))
      vi.mocked(fetchSessionState).mockClear()
      vi.mocked(fetchSession).mockClear()
      vi.mocked(fetchSessionParts).mockClear()
      vi.mocked(fetchCurrentExplanation).mockClear()

      act(() => {
        cableHandlers?.received?.({ event: 'part_change', data: publication(state(11, 102)) })
      })

      await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:102'))
      await waitFor(() => expect(fetchCurrentExplanation).toHaveBeenCalledTimes(1))
      expect(fetchSessionState).not.toHaveBeenCalled()
      expect(fetchSession).not.toHaveBeenCalled()
      expect(fetchSessionParts).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not verify a contiguous first publication batched with reconnect confirmation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
    const view = render(<SharedSubscriberProbe />, { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:101'))
    expect(cableHandlers).not.toBeNull()

    act(() => cableHandlers?.connected?.())
    act(() => cableHandlers?.disconnected?.())
    vi.mocked(fetchSessionState).mockClear()
    vi.mocked(fetchSession).mockClear()
    vi.mocked(fetchSessionParts).mockClear()
    vi.mocked(fetchCurrentExplanation).mockClear()

    act(() => {
      cableHandlers?.connected?.()
      cableHandlers?.received?.({ event: 'part_change', data: publication(state(11, 102)) })
    })

    await waitFor(() => expect(view.getByTestId('reading')).toHaveTextContent('lp:102'))
    await waitFor(() => expect(fetchCurrentExplanation).toHaveBeenCalledTimes(1))
    expect(fetchSessionState).not.toHaveBeenCalled()
    expect(fetchSession).not.toHaveBeenCalled()
    expect(fetchSessionParts).not.toHaveBeenCalled()
  })
})
