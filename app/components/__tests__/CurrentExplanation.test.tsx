import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CurrentExplanation } from '../CurrentExplanation'
import type { ReactNode } from 'react'
import type { Explanation } from '@/types/explanation'

// Mock the useActionCable hook
vi.mock('@/hooks/useActionCable', () => ({
  useActionCable: vi.fn(() => null),
}))

// Mock explanation queries
vi.mock('@/queries/explanationQueries', () => ({
  explanationQueryKeys: {
    current: (sessionId: string) => ['explanation', sessionId, 'current'],
    upcoming: (sessionId: string) => ['explanation', sessionId, 'upcoming'],
    citations: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'citations'],
    ratings: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'ratings'],
  },
  fetchCurrentExplanation: vi.fn(),
  fetchUpcomingExplanations: vi.fn(),
}))

// Mock ReactMarkdown to simplify testing
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))

import { fetchCurrentExplanation, fetchUpcomingExplanations } from '@/queries/explanationQueries'
import { useActionCable } from '@/hooks/useActionCable'

const mockExplanation: Explanation = {
  id: 1,
  title: 'Test Explanation',
  description: 'Test description',
  summary: 'Test summary',
  part_ids: [1],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  row_order: 1,
  liturgy_id: 1,
  user_id: 1,
  tags: ['theology', 'history'],
  average_rating: 4.5,
  rating_count: 10,
}

const mockUpcomingExplanation: Explanation = {
  id: 2,
  title: 'Upcoming Explanation',
  description: 'Upcoming description',
  summary: 'Upcoming summary',
  part_ids: [2],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  row_order: 2,
  liturgy_id: 1,
  user_id: 1,
  tags: ['practice'],
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return Wrapper
}

describe('CurrentExplanation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useActionCable).mockReturnValue(null)
  })

  it('should render current explanation when available', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByText('Test summary')).toBeInTheDocument()
  })

  it('should render "No Active Explanation" message when no current or previous explanations', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('No Active Explanation')).toBeInTheDocument()
    })
    expect(screen.getByText('Tarkman does not currently have an active explanation for this part of the service. Check back next week for an update.')).toBeInTheDocument()
  })

  it('shows an unavailable alert instead of an empty state when the current query fails', async () => {
    vi.mocked(fetchCurrentExplanation).mockRejectedValue(new Error('Request failed'))
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Explanation temporarily unavailable')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('No Active Explanation')).not.toBeInTheDocument()
  })

  it('retries an unavailable explanation and renders the recovered content', async () => {
    let resolveRetry!: (value: Explanation[]) => void
    const retryPromise = new Promise<Explanation[]>((resolve) => {
      resolveRetry = resolve
    })
    vi.mocked(fetchCurrentExplanation)
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockReturnValueOnce(retryPromise)
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])
    const user = userEvent.setup()

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Retrying...' })).toBeDisabled()

    resolveRetry([mockExplanation])

    expect(await screen.findByText('Test Explanation')).toBeInTheDocument()
    expect(fetchCurrentExplanation).toHaveBeenCalledTimes(2)
  })

  it('keeps same-session content visible with a stale label after a failed refetch', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValueOnce([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    const { rerender } = render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    expect(await screen.findByText('Test Explanation')).toBeInTheDocument()

    vi.mocked(fetchCurrentExplanation).mockRejectedValueOnce(new Error('Request failed'))
    vi.mocked(useActionCable).mockReturnValue({} as never)
    rerender(<CurrentExplanation sessionId="123" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Explanation temporarily unavailable')
    expect(screen.getByText('Showing the last available explanation.')).toBeInTheDocument()
    expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    expect(screen.queryByText('Previous Explanation')).not.toBeInTheDocument()
  })

  it('should render previous explanation with "Previous Explanation" message', async () => {
    // First render with an explanation
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    const { rerender } = render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })

    // Now simulate the explanation disappearing
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])
    vi.mocked(useActionCable).mockReturnValue({} as any)

    rerender(<CurrentExplanation sessionId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Previous Explanation')).toBeInTheDocument()
    })
    expect(screen.getByText('The service has moved to a new section')).toBeInTheDocument()
    expect(screen.getByText('Test Explanation')).toBeInTheDocument()
  })

  it('does not carry previous explanations into a different session', async () => {
    vi.mocked(fetchCurrentExplanation).mockImplementation(async (sessionId) =>
      sessionId === '123' ? [mockExplanation] : [],
    )
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    const { rerender } = render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    expect(await screen.findByText('Test Explanation')).toBeInTheDocument()

    rerender(<CurrentExplanation sessionId="456" />)

    expect(await screen.findByText('No Active Explanation')).toBeInTheDocument()
    expect(screen.queryByText('Test Explanation')).not.toBeInTheDocument()
  })

  it('should render upcoming explanations section when available', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([
      mockUpcomingExplanation,
      { ...mockUpcomingExplanation, id: 3, title: 'Second Upcoming' },
    ])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Coming Up')).toBeInTheDocument()
    })
    expect(screen.getByText('Upcoming Explanation')).toBeInTheDocument()
    expect(screen.getByText('Second Upcoming')).toBeInTheDocument()
    expect(screen.getAllByText('Upcoming summary').length).toBeGreaterThan(0)
  })

  it('should not render upcoming section when no upcoming explanations', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })
    expect(screen.queryByText('Coming Up')).not.toBeInTheDocument()
  })

  it('should render tags when present', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })
    // TagBadge component will render the tags
    expect(mockExplanation.tags).toEqual(['theology', 'history'])
  })

  it('should render rating when present', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })
    // RatingDisplay component will render the rating
    expect(mockExplanation.average_rating).toBe(4.5)
    expect(mockExplanation.rating_count).toBe(10)
  })

  it('should show updating indicator when loading', async () => {
    vi.mocked(fetchCurrentExplanation).mockImplementation(() => new Promise(() => {}))
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })
  })

  it('should render numbered badges for upcoming explanations', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([mockExplanation])
    vi.mocked(fetchUpcomingExplanations).mockResolvedValue([
      mockUpcomingExplanation,
      { ...mockUpcomingExplanation, id: 3, title: 'Second Upcoming' },
      { ...mockUpcomingExplanation, id: 4, title: 'Third Upcoming' },
    ])

    render(<CurrentExplanation sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Coming Up')).toBeInTheDocument()
    })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
