import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from '@/routeTree.gen'
import { AuthProvider } from '@/contexts/AuthContext'
import { login, logout } from '@/api/auth'
import { fetchSessions } from '@/queries/sessions'

// Mock the login API
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    all: ['sessions'],
    list: () => ['sessions', 'list'],
    session: (id: string) => ['sessions', 'session', id],
    sessionParts: (id: string) => ['sessions', 'session', id, 'parts'],
  },
  fetchSessions: vi.fn(),
}))

// Mock the session polling to avoid errors in dashboard
vi.mock('@/hooks/useSessionPolling', () => ({
  useSessionPolling: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(fetchSessions).mockResolvedValue([])
  })

  it('should allow user to login and logout', async () => {
    const user = userEvent.setup()
    
    // Setup API mock
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      roles: []
    }
    vi.mocked(login).mockResolvedValue({
      user: mockUser,
      token: 'fake-token'
    })

    // Initialize router at login page
    const history = createMemoryHistory({ initialEntries: ['/login'] })
    const router = createRouter({ routeTree, history })

    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // 1. Verify we are on login page
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()

    // 2. Fill in login form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    
    // 3. Submit form
    await user.click(screen.getByRole('button', { name: /sign in to your account/i }))

    // 4. Verify navigation to home/dashboard (look for elements that appear after login)
    // Note: Depending on your app structure, you might check for specific dashboard content
    // or the absence of the login form.
    await waitFor(() => {
      expect(history.location.pathname).toBe('/')
    })

    // 5. Verify the state change through the authentication call.
    expect(login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })

    // Verify token in local storage
    expect(localStorage.getItem('token')).toBe('fake-token')

    // 6. Perform Logout
    // We need to find the logout button. In Navbar, AuthLink renders "Log in" or "Log out"
    // Let's try to find it.
    
    // If strictly testing UI, we should click logout. 
    // AuthLink renders "Sign Out" in the dump we saw
    const logoutLink = screen.getByText(/sign out/i)
    expect(logoutLink).toBeInTheDocument()
    
    await user.click(logoutLink)

    expect(logout).toHaveBeenCalled()

    // 7. Verify Logout
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull()
    })
    
    // Verify UI reflects logged out state
    // It likely says "Sign In" or "Login" - let's check for "Sign In" based on typical patterns or the "Sign Out" counterpart
    // But based on the Navbar dump, we might see "Sign In" or just AuthLink state change.
    // Let's verify "Sign Out" is GONE first.
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument()
  })
})
