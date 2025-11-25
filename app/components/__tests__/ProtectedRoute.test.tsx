import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryHistory, RouterProvider, createRouter } from '@tanstack/react-router'
import { ProtectedRoute } from '../ProtectedRoute'
import { createRootRoute, Route, Outlet } from '@tanstack/react-router'
import { createMockUser } from '../../__tests__/factories'
import type { ReactNode } from 'react'

// Mock AuthContext
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as any).location
    window.location = { pathname: '/dashboard' } as any
  })

  const renderProtectedRoute = (children: ReactNode, authState: any) => {
    mockUseAuth.mockReturnValue(authState)

    // Create a simple route tree for testing
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const dashboardRoute = new Route({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      component: () => (
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      ),
    })

    const loginRoute = new Route({
      getParentRoute: () => rootRoute,
      path: '/login',
      component: () => <div>Login Page</div>,
    })

    const routeTree = rootRoute.addChildren([dashboardRoute, loginRoute])
    const history = createMemoryHistory({ initialEntries: ['/dashboard'] })
    const router = createRouter({ routeTree, history })

    return render(<RouterProvider router={router as any} />)
  }

  it('should render children when user is authenticated', () => {
    const mockUser = createMockUser()

    renderProtectedRoute(
      <div data-testid="protected-content">Protected Content</div>,
      { user: mockUser, token: 'fake-token' }
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('should return null when user is not authenticated', () => {
    renderProtectedRoute(
      <div data-testid="protected-content">Protected Content</div>,
      { user: null, token: null }
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('should navigate to login when user is not authenticated', async () => {
    renderProtectedRoute(
      <div data-testid="protected-content">Protected Content</div>,
      { user: null, token: null }
    )

    // Wait for navigation to occur
    await waitFor(() => {
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })
  })

  it('should work with admin user', () => {
    const adminUser = createMockUser({ roles: ['admin'], email: 'admin@example.com' })

    renderProtectedRoute(
      <div data-testid="admin-content">Admin Dashboard</div>,
      { user: adminUser, token: 'admin-token' }
    )

    expect(screen.getByTestId('admin-content')).toBeInTheDocument()
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('should render multiple children', () => {
    const mockUser = createMockUser()

    renderProtectedRoute(
      <>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </>,
      { user: mockUser, token: 'fake-token' }
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
    expect(screen.getByTestId('child-3')).toBeInTheDocument()
  })

  it('should handle complex child components', () => {
    const mockUser = createMockUser()

    const ComplexChild = () => (
      <div>
        <h1>Dashboard</h1>
        <p>Welcome, user!</p>
        <button>Action</button>
      </div>
    )

    renderProtectedRoute(<ComplexChild />, { user: mockUser, token: 'fake-token' })

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Welcome, user!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('should handle user with token', () => {
    const mockUser = createMockUser({ id: 5, email: 'user5@example.com' })

    renderProtectedRoute(
      <div data-testid="user-specific">User ID: {mockUser.id}</div>,
      { user: mockUser, token: 'user5-token' }
    )

    expect(screen.getByTestId('user-specific')).toBeInTheDocument()
    expect(screen.getByText(`User ID: ${mockUser.id}`)).toBeInTheDocument()
  })

  it('should handle editor user', () => {
    const editorUser = createMockUser({ roles: ['editor'], email: 'editor@example.com' })

    renderProtectedRoute(
      <div data-testid="editor-content">Editor Dashboard</div>,
      { user: editorUser, token: 'editor-token' }
    )

    expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    expect(screen.getByText('Editor Dashboard')).toBeInTheDocument()
  })
})
