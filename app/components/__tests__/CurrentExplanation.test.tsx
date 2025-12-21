import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CurrentExplanation } from '../CurrentExplanation'
import type { ReactNode } from 'react'
import type { Explanation } from '@/types/explanation'

// Mock the usePusher hook
vi.mock('@/hooks/usePusher', () => ({
  usePusher: vi.fn(() => null),
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
import { usePusher } from '@/hooks/usePusher'

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
    vi.mocked(usePusher).mockReturnValue(null)
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
    expect(screen.getByText('There is currently no explanation for this part of the service')).toBeInTheDocument()
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
    vi.mocked(usePusher).mockReturnValue({} as any)

    rerender(<CurrentExplanation sessionId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Previous Explanation')).toBeInTheDocument()
    })
    expect(screen.getByText('The service has moved to a new section')).toBeInTheDocument()
    expect(screen.getByText('Test Explanation')).toBeInTheDocument()
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
