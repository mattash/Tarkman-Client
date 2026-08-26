import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SessionParts } from '../SessionParts'
import { LanguageProvider } from '../../contexts/LanguageContext'
import { fetchSession, fetchSessionParts } from '../../queries/sessions'
import { useActionCable } from '../../hooks/useActionCable'
import { createMockPart } from '../../__tests__/factories/mockPartFactory'

vi.mock('../../queries/sessions', () => ({
  fetchSession: vi.fn(),
  fetchSessionParts: vi.fn(),
  sessionsKeys: {
    sessionParts: (id: string) => ['sessions', 'session', id, 'parts'] as const,
    session: (id: string) => ['sessions', 'session', id] as const,
  },
}))

vi.mock('../../hooks/useActionCable', () => ({
  useActionCable: vi.fn(() => null),
}))

vi.mock('../PartCard', () => ({
  default: ({ part }: { part: { en: string } }) => <li>{part.en}</li>,
}))

vi.mock('../../hooks/usePartScroll', () => ({
  usePartScroll: vi.fn(() => ({ partsRef: { current: {} }, handlePartUpdated: vi.fn() })),
}))

const sessionData = {
  sessionData: {
    session: {
      id: 1,
      liturgy: 'Divine Liturgy',
      liturgy_id: 1,
      date: '2024-01-01',
      church_name: 'St. John',
      church_avatar: null,
      occupied: true,
      num_of_parts: 2,
      current_part_position: 1,
      current_part_id: null,
      current_liturgy_id: 1,
      page: 1,
      posture: null,
      readings: { gospel: '', epistle: '' },
      options: {},
    },
  },
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  )
}

describe('SessionParts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useActionCable).mockReturnValue(null)
  })

  it('renders a liturgy that repeats the same part without duplicate React keys', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetchSession).mockResolvedValue(sessionData.sessionData as never)
    vi.mocked(fetchSessionParts).mockResolvedValue({
      ...sessionData,
      parts: [
        createMockPart({ id: 1, liturgy_part_id: 1, en: 'Our Father, who art in heaven' }),
        createMockPart({ id: 1, liturgy_part_id: 2, en: 'Our Father, who art in heaven' }),
      ],
    } as never)

    render(<SessionParts sessionId="1" />, { wrapper: makeWrapper() })

    const matches = await screen.findAllByText(/Our Father/)
    expect(matches.length).toBeGreaterThanOrEqual(2)
    const keyWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    )
    expect(keyWarnings).toEqual([])

    consoleSpy.mockRestore()
  })
})
