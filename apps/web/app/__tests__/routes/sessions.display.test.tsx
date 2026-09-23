import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'
import { createMockSession } from '../factories/mockSessionFactory'

// Mock the Navbar component
vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}))

// Mock the ExplanationIndicator component
vi.mock('@/components/ExplanationIndicator', () => ({
  ExplanationIndicator: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="explanation-indicator">Explanation Indicator {sessionId}</div>
  ),
}))

// Mock the AuthProvider
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, token: null }),
}))

// Mock the SessionPartsParallel component
vi.mock('@/components/SessionPartsParallel', () => ({
  SessionPartsParallel: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="session-parts-parallel">Parallel Parts for {sessionId}</div>
  ),
}))

// Mock the Message component
vi.mock('@/components/Message', () => ({
  Message: ({ message }: { message: string }) => (
    <div data-testid="message">{message}</div>
  ),
}))

// Mock the StatusOverlay component
vi.mock('@/components/StatusOverlay', () => ({
  StatusOverlay: () => null,
}))

vi.mock('@/hooks/useLiveSession', () => ({
  useLiveSession: vi.fn((_id: string, initialSession: ReturnType<typeof createMockSession>) => ({
    sessionData: initialSession, parts: [], partsRef: { current: {} }, currentPartId: null, currentPartKey: null,
    isLoading: false, error: null, connectionState: 'connected',
  })),
}))

import { useLiveSession } from '@/hooks/useLiveSession'

// Mock the MinimalStatusView component
vi.mock('@/components/MinimalStatusView', () => ({
  MinimalStatusView: ({ statusView, page, posture }: { statusView: string; page?: number; posture?: string }) => (
    <div data-testid="minimal-status-view" data-status-view={statusView}>
      {statusView === 'pages_only' ? `Page: ${page}` : `Posture: ${posture}`}
    </div>
  ),
}))

// Mock the SessionPartsSingle component
vi.mock('@/components/SessionPartsSingle', () => ({
  SessionPartsSingle: ({ sessionId, lang1 }: { sessionId: string; lang1?: string }) => (
    <div data-testid="session-parts-single">Single Parts for {sessionId} ({lang1})</div>
  ),
}))

// Mock the useSessionPolling hook
const mockUseSessionPolling = vi.fn()
vi.mock('@/hooks/useSessionPolling', () => ({
  useSessionPolling: () => mockUseSessionPolling(),
}))

// Mock the useUserSessionPolling hook
const mockUseUserSessionPolling = vi.fn()
vi.mock('@/hooks/useUserSessionPolling', () => ({
  useUserSessionPolling: () => mockUseUserSessionPolling(),
}))

// Mock fetchDisplayLink
const mockFetchDisplayLink = vi.fn()
vi.mock('@/queries/displayLinks', () => ({
  fetchDisplayLink: (...args: unknown[]) => mockFetchDisplayLink(...args),
  displayLinkKeys: {
    all: ['displayLinks'] as const,
    detail: (token: string) => ['displayLinks', token] as const,
  },
}))

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const mockSessionData = createMockSession({
  id: 10,
  liturgy: 'Divine Liturgy',
  liturgy_id: 1,
  date: '2025-11-24',
  church_name: 'St. John',
  occupied: true,
  num_of_parts: 10,
  current_part_position: 5,
  current_part_id: 50,
  current_liturgy_id: 1,
  page: 15,
  posture: 'stand',
  readings: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
  },
  options: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
    before_message: 'Welcome to our service!',
    after_message: 'Thank you for attending!',
  },
})

describe('sessions.display route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUserSessionPolling.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })
  })

  it('should show loading view when isLoading is true', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should show loading view when isError is true', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should show loading view when sessionWrapper is null', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should render SessionPartsParallel when session data is available', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByTestId('session-parts-parallel')).toBeInTheDocument()
    expect(screen.getByTestId('session-parts-parallel')).toHaveTextContent('Parallel Parts for 10')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an unobtrusive reconnecting badge while recovering', async () => {
    mockUseSessionPolling.mockReturnValue({ data: mockSessionData, isLoading: false, isError: false })
    vi.mocked(useLiveSession).mockReturnValueOnce({
      sessionData: mockSessionData, parts: [], partsRef: { current: {} }, currentPartId: null, currentPartKey: null,
      isLoading: false, error: null, connectionState: 'recovering',
    })

    const history = createMemoryHistory({ initialEntries: ['/sessions/display'] })
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />, { wrapper: createTestWrapper() })

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Reconnecting…')
  })

  it('should show welcome message when at position 0 and before_message is set', async () => {
    const sessionAtStart = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        current_part_position: 0,
        status: 'active' as const,
      },
    }

    mockUseSessionPolling.mockReturnValue({
      data: sessionAtStart,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    const messages = await screen.findAllByTestId('message')
    expect(messages[0]).toHaveTextContent('Welcome to our service!')
  })

  it('should show farewell message when at last position and after_message is set', async () => {
    const sessionAtEnd = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        current_part_position: 9, // num_of_parts - 1
        num_of_parts: 10,
        status: 'active' as const,
      },
    }

    mockUseSessionPolling.mockReturnValue({
      data: sessionAtEnd,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    const messages = await screen.findAllByTestId('message')
    expect(messages[0]).toHaveTextContent('Thank you for attending!')
  })

  it('should not show welcome message when not at position 0', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    await screen.findByTestId('session-parts-parallel')
    expect(screen.queryByText('Welcome to our service!')).not.toBeInTheDocument()
  })

  it('should not show farewell message when not at last position', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    await screen.findByTestId('session-parts-parallel')
    expect(screen.queryByText('Thank you for attending!')).not.toBeInTheDocument()
  })

  it('should not show welcome message when before_message is empty', async () => {
    const sessionNoWelcome = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        current_part_position: 0,
        options: {
          ...mockSessionData.session.options,
          before_message: '',
        },
      },
    }

    mockUseSessionPolling.mockReturnValue({
      data: sessionNoWelcome,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    await screen.findByTestId('session-parts-parallel')
    expect(screen.queryByTestId('message')).not.toBeInTheDocument()
  })

  describe('with token (display link)', () => {
    beforeEach(() => {
      mockUseSessionPolling.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      })
      mockUseUserSessionPolling.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      })
      mockFetchDisplayLink.mockReset()
    })

    it('should show invalid token error when display link fetch fails', async () => {
      mockFetchDisplayLink.mockRejectedValue(new Error('Not found'))

      const history = createMemoryHistory({
        initialEntries: ['/sessions/display?token=bad-token-fail'],
      })

      const router = createRouter({
        routeTree,
        history,
      })

      render(
        <RouterProvider router={router} />,
        { wrapper: createTestWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired display link.')).toBeInTheDocument()
      })
    })

    it('should render session in single mode with lang2=null from display link config', async () => {
      mockFetchDisplayLink.mockResolvedValue({
        token: 'test-token-single',
        mode: 'single',
        lang1: 'en',
        lang2: null,
        show_explanations: true,
        show_notifications: true,
        status_view: 'full',
        user_id: 42,
        church_name: 'St. John',
      })

      mockUseUserSessionPolling.mockReturnValue({
        data: mockSessionData,
        isLoading: false,
        isError: false,
      })

      const history = createMemoryHistory({
        initialEntries: ['/sessions/display?token=test-token-single'],
      })

      const router = createRouter({
        routeTree,
        history,
      })

      render(
        <RouterProvider router={router} />,
        { wrapper: createTestWrapper() }
      )

      await waitFor(() => {
        expect(screen.getByTestId('session-parts-single')).toBeInTheDocument()
        expect(screen.getByTestId('session-parts-single')).toHaveTextContent('en')
      })
    })

    it('should render MinimalStatusView when status_view is pages_only', async () => {
      mockFetchDisplayLink.mockResolvedValue({
        token: 'test-token-pages',
        mode: 'parallel',
        lang1: 'translit',
        lang2: 'en',
        show_explanations: true,
        show_notifications: true,
        status_view: 'pages_only',
        user_id: 42,
      })

      mockUseUserSessionPolling.mockReturnValue({
        data: mockSessionData,
        isLoading: false,
        isError: false,
      })

      const history = createMemoryHistory({
        initialEntries: ['/sessions/display?token=test-token-pages'],
      })

      const router = createRouter({
        routeTree,
        history,
      })

      render(
        <RouterProvider router={router} />,
        { wrapper: createTestWrapper() }
      )

      await waitFor(() => {
        const el = screen.getByTestId('minimal-status-view')
        expect(el).toBeInTheDocument()
        expect(el).toHaveAttribute('data-status-view', 'pages_only')
        expect(el).toHaveTextContent('Page: 1')
      })
    })

    it('should render MinimalStatusView when status_view is posture_only', async () => {
      mockFetchDisplayLink.mockResolvedValue({
        token: 'test-token-posture',
        mode: 'parallel',
        lang1: 'translit',
        lang2: 'en',
        show_explanations: true,
        show_notifications: true,
        status_view: 'posture_only',
        user_id: 42,
      })

      mockUseUserSessionPolling.mockReturnValue({
        data: mockSessionData,
        isLoading: false,
        isError: false,
      })

      const history = createMemoryHistory({
        initialEntries: ['/sessions/display?token=test-token-posture'],
      })

      const router = createRouter({
        routeTree,
        history,
      })

      render(
        <RouterProvider router={router} />,
        { wrapper: createTestWrapper() }
      )

      await waitFor(() => {
        const el = screen.getByTestId('minimal-status-view')
        expect(el).toBeInTheDocument()
        expect(el).toHaveAttribute('data-status-view', 'posture_only')
        expect(el).toHaveTextContent('Posture: stand')
      })
    })
  })
})
