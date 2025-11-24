import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'
import type { SessionWrapper } from '@/types/session'

// Mock the Navbar component
vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
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

// Mock the useSessionPolling hook
const mockUseSessionPolling = vi.fn()
vi.mock('@/hooks/useSessionPolling', () => ({
  useSessionPolling: () => mockUseSessionPolling(),
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

const mockSessionData: SessionWrapper = {
  session: {
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
  },
}

describe('sessions.display route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading view when isLoading is true', () => {
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

    expect(screen.getByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should show loading view when isError is true', () => {
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

    expect(screen.getByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should show loading view when sessionWrapper is null', () => {
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

    expect(screen.getByText('Waiting for session...')).toBeInTheDocument()
  })

  it('should render SessionPartsParallel when session data is available', () => {
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

    expect(screen.getByTestId('session-parts-parallel')).toBeInTheDocument()
    expect(screen.getByTestId('session-parts-parallel')).toHaveTextContent('Parallel Parts for 10')
  })

  it('should show welcome message when at position 0 and before_message is set', () => {
    const sessionAtStart = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        current_part_position: 0,
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

    const messages = screen.getAllByTestId('message')
    expect(messages[0]).toHaveTextContent('Welcome to our service!')
  })

  it('should show farewell message when at last position and after_message is set', () => {
    const sessionAtEnd = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        current_part_position: 9, // num_of_parts - 1
        num_of_parts: 10,
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

    const messages = screen.getAllByTestId('message')
    expect(messages[0]).toHaveTextContent('Thank you for attending!')
  })

  it('should not show welcome message when not at position 0', () => {
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

    expect(screen.queryByText('Welcome to our service!')).not.toBeInTheDocument()
  })

  it('should not show farewell message when not at last position', () => {
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

    expect(screen.queryByText('Thank you for attending!')).not.toBeInTheDocument()
  })

  it('should not show welcome message when before_message is empty', () => {
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

    expect(screen.queryByTestId('message')).not.toBeInTheDocument()
  })
})
