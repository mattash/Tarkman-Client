import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'
import { createMockSession } from '../factories/mockSessionFactory'

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}))

vi.mock('@/components/ExplanationIndicator', () => ({
  ExplanationIndicator: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="explanation-indicator">Explanation Indicator {sessionId}</div>
  ),
}))

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, token: null }),
}))

vi.mock('@/components/SessionPartsParallel', () => ({
  SessionPartsParallel: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="session-parts-parallel">Parallel Parts for {sessionId}</div>
  ),
}))

vi.mock('@/components/Message', () => ({
  Message: ({ message }: { message: string }) => (
    <div data-testid="message">{message}</div>
  ),
}))

vi.mock('@/components/StatusOverlay', () => ({
  StatusOverlay: () => null,
}))

vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    session: (id: string) => ['sessions', 'session', id],
  },
  fetchSession: vi.fn(),
}))

import { fetchSession } from '@/queries/sessions'

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

describe('sessions.$id.display route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading view while fetching the selected session', () => {
    vi.mocked(fetchSession).mockImplementation(() => new Promise(() => {}))

    const history = createMemoryHistory({
      initialEntries: ['/sessions/123/display'],
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

  it('should render display components for the session id in the URL', async () => {
    vi.mocked(fetchSession).mockResolvedValue(
      createMockSession({
        id: 456,
        current_part_position: 2,
      })
    )

    const history = createMemoryHistory({
      initialEntries: ['/sessions/456/display'],
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
      expect(fetchSession).toHaveBeenCalledWith('456')
    })

    expect(screen.getByTestId('session-parts-parallel')).toHaveTextContent('Parallel Parts for 456')
    expect(screen.getByTestId('explanation-indicator')).toHaveTextContent('Explanation Indicator 456')
  })
})
