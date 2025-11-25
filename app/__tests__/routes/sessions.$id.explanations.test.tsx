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

// Mock the AuthProvider
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, token: null }),
}))

// Mock the CurrentExplanation component
vi.mock('@/components/CurrentExplanation', () => ({
  CurrentExplanation: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="current-explanation">Current Explanation for session {sessionId}</div>
  ),
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

describe('sessions.$id.explanations route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render CurrentExplanation component with correct sessionId', () => {
    const history = createMemoryHistory({
      initialEntries: ['/sessions/123/explanations'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('current-explanation')).toBeInTheDocument()
    expect(screen.getByTestId('current-explanation')).toHaveTextContent(
      'Current Explanation for session 123'
    )
  })

  it('should render with different sessionId', () => {
    const history = createMemoryHistory({
      initialEntries: ['/sessions/456/explanations'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('current-explanation')).toBeInTheDocument()
    expect(screen.getByTestId('current-explanation')).toHaveTextContent(
      'Current Explanation for session 456'
    )
  })

  it('should handle numeric sessionIds correctly', () => {
    const history = createMemoryHistory({
      initialEntries: ['/sessions/999/explanations'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(screen.getByTestId('current-explanation')).toBeInTheDocument()
    expect(screen.getByTestId('current-explanation')).toHaveTextContent(
      'Current Explanation for session 999'
    )
  })
})
