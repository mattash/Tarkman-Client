import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'
import { createMockSession } from '../factories/mockSessionFactory'

// Mock the Navbar component
vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}))

// Mock the AuthProvider
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, token: null }),
}))

// Mock the Posture component
vi.mock('@/components/Posture', () => ({
  Posture: ({ posture }: { posture: string }) => (
    <div data-testid="posture">Posture: {posture}</div>
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
  page: 42,
  posture: 'stand',
  readings: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
  },
  options: {
    gospel: 'John 3:16',
    epistle: 'Romans 8:28',
    before_message: 'Welcome',
    after_message: 'Farewell',
  },
})

describe('sessions.status.display route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading view when isLoading is true', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
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
      initialEntries: ['/sessions/status/display'],
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

  it('should show "No active session" when sessionWrapper is null', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('No active session')).toBeInTheDocument()
  })

  it('should display page number when session data is available', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('42')).toBeInTheDocument()
  })

  it('should display Posture component with correct posture', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByTestId('posture')).toBeInTheDocument()
    expect(screen.getByTestId('posture')).toHaveTextContent('Posture: stand')
  })

  it('should display BookOpen icon', async () => {
    mockUseSessionPolling.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    const { container } = render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    // Check for the SVG element from lucide-react
    await screen.findByText('42')
    const bookIcon = container.querySelector('svg')
    expect(bookIcon).toBeInTheDocument()
  })

  it('should display different page numbers correctly', async () => {
    const sessionWithDifferentPage = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        page: 123,
      },
    }

    mockUseSessionPolling.mockReturnValue({
      data: sessionWithDifferentPage,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByText('123')).toBeInTheDocument()
  })

  it('should display different postures correctly', async () => {
    const sessionWithSitting = {
      ...mockSessionData,
      session: {
        ...mockSessionData.session,
        posture: 'sit',
      },
    }

    mockUseSessionPolling.mockReturnValue({
      data: sessionWithSitting,
      isLoading: false,
      isError: false,
    })

    const history = createMemoryHistory({
      initialEntries: ['/sessions/status/display'],
    })

    const router = createRouter({
      routeTree,
      history,
    })

    render(
      <RouterProvider router={router} />,
      { wrapper: createTestWrapper() }
    )

    expect(await screen.findByTestId('posture')).toHaveTextContent('Posture: sit')
  })
})
