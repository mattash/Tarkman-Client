import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'

// Mock the Navbar component
vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}))

// Mock the SessionParts component
vi.mock('@/components/SessionParts', () => ({
  SessionParts: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="session-parts">Session Parts for {sessionId}</div>
  ),
}))

// Mock the SessionControls component
vi.mock('@/components/SessionControls', () => ({
  SessionControls: ({ sessionId }: { sessionId: number }) => (
    <div data-testid="session-controls">Controls for session {sessionId}</div>
  ),
}))

// Mock the ExplanationDrawer component
vi.mock('@/components/ExplanationDrawer', () => ({
  ExplanationDrawer: ({ sessionId, title }: { sessionId: string; title?: string }) => (
    <div data-testid="explanation-drawer">
      {title || 'Explanation'} for {sessionId}
    </div>
  ),
}))

// Mock the AuthContext
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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

describe('sessions.$id.parts route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render SessionParts component with correct sessionId', () => {
    mockUseAuth.mockReturnValue({ user: null, token: null })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/123/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('session-parts')).toBeInTheDocument()
    expect(screen.getByTestId('session-parts')).toHaveTextContent('Session Parts for 123')
  })

  it('should show ExplanationDrawer when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, token: null })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/456/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('explanation-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('explanation-drawer')).toHaveTextContent('Explanations for 456')
  })

  it('should not show ExplanationDrawer when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com' },
      token: 'fake-token'
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/789/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.queryByTestId('explanation-drawer')).not.toBeInTheDocument()
  })

  it('should show SessionControls when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'admin@example.com' },
      token: 'fake-token'
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/999/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('session-controls')).toBeInTheDocument()
    expect(screen.getByTestId('session-controls')).toHaveTextContent('Controls for session 999')
  })

  it('should not show SessionControls when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, token: null })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/100/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.queryByTestId('session-controls')).not.toBeInTheDocument()
  })

  it('should convert sessionId from string to number for SessionControls', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'admin@example.com' },
      token: 'fake-token'
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/555/parts'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    const controls = screen.getByTestId('session-controls')
    expect(controls).toHaveTextContent('Controls for session 555')
  })
})
