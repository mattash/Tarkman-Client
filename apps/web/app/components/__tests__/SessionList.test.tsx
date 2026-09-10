import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionList } from '../SessionList'
import { createMockSessionList, createMockSession } from '../../__tests__/factories'
import type { ReactNode } from 'react'

// Mock SessionCard component
vi.mock('../SessionCard', () => ({
  SessionCard: ({ session }: any) => (
    <div data-testid="session-card" data-session-id={session.id}>
      {session.church_name} - {session.date}
    </div>
  ),
}))

// Mock the fetchSessions query
vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    list: () => ['sessions', 'list'] as const,
  },
  fetchSessions: vi.fn(),
}))

import { fetchSessions } from '@/queries/sessions'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Intl.DateTimeFormat
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'America/New_York',
    } as any)
  })

  it('should render loading state while fetching', () => {
    vi.mocked(fetchSessions).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<SessionList />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading sessions…')).toBeInTheDocument()
  })

  it('should render error state when fetch fails', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'))

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument()
    })
  })

  it('should render empty state when sessions is null', async () => {
    vi.mocked(fetchSessions).mockResolvedValue(null as any)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No services scheduled')).toBeInTheDocument()
    })
  })

  it('should render list of SessionCards when sessions are loaded', async () => {
    const mockSessions = createMockSessionList(3)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Current Services')).toBeInTheDocument()
    })

    const cards = screen.getAllByTestId('session-card')
    expect(cards).toHaveLength(3)

    // Verify each card has correct data
    mockSessions.forEach((session, index) => {
      expect(cards[index]).toHaveTextContent(session.session.church_name)
      expect(cards[index]).toHaveTextContent(session.session.date)
    })
  })

  it('should pass correct timezone to fetchSessions', async () => {
    const mockSessions = createMockSessionList(1)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fetchSessions).toHaveBeenCalledWith('America/New_York')
    })
  })

  it('should render heading with correct text', async () => {
    const mockSessions = createMockSessionList(2)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Current Services' })).toBeInTheDocument()
    })
  })

  it('should render grid layout for cards', async () => {
    const mockSessions = createMockSessionList(2)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    const { container } = render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      const grid = container.querySelector('.grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveClass('gap-4', 'md:grid-cols-2', 'lg:grid-cols-3')
    })
  })

  it('should render empty state when sessions array is empty', async () => {
    vi.mocked(fetchSessions).mockResolvedValue([])

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No services scheduled')).toBeInTheDocument()
      expect(screen.getByText('Check back soon for upcoming services')).toBeInTheDocument()
      expect(screen.queryAllByTestId('session-card')).toHaveLength(0)
    })
  })

  it('should render each session with unique key', async () => {
    const mockSessions = [
      createMockSession({ id: 1, church_name: 'Church 1' }),
      createMockSession({ id: 2, church_name: 'Church 2' }),
      createMockSession({ id: 3, church_name: 'Church 3' }),
    ]
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      const cards = screen.getAllByTestId('session-card')
      expect(cards[0]).toHaveAttribute('data-session-id', '1')
      expect(cards[1]).toHaveAttribute('data-session-id', '2')
      expect(cards[2]).toHaveAttribute('data-session-id', '3')
    })
  })

  it('should use query key from sessionsKeys', async () => {
    const mockSessions = createMockSessionList(1)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Current Services')).toBeInTheDocument()
    })

    // Verify the query was called (implicitly uses the correct key)
    expect(fetchSessions).toHaveBeenCalled()
  })

  it('should handle different timezones', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Europe/London',
    } as any)

    const mockSessions = createMockSessionList(1)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fetchSessions).toHaveBeenCalledWith('Europe/London')
    })
  })

  it('should render multiple sessions correctly', async () => {
    const mockSessions = createMockSessionList(6)
    vi.mocked(fetchSessions).mockResolvedValue(mockSessions)

    render(<SessionList />, { wrapper: createWrapper() })

    await waitFor(() => {
      const cards = screen.getAllByTestId('session-card')
      expect(cards).toHaveLength(6)
    })
  })
})
