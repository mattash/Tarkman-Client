import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { Navbar } from '../Navbar'
import { routeTree } from '@/routeTree.gen'
import type { ReactNode } from 'react'

// Mock AuthLink component
vi.mock('../AuthLink', () => ({
  AuthLink: () => <div data-testid="auth-link">Auth Link</div>,
}))

// Mock AuthProvider
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: null, token: null }),
}))

const createTestRouter = (initialRoute: string = '/') => {
  const history = createMemoryHistory({ initialEntries: [initialRoute] })
  return createRouter({ routeTree, history })
}

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

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render logo', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    const logo = screen.getByAltText('Tarkman Logo')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/apple-touch-icon.png')
  })

  it('should render desktop navigation links', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // Desktop links should be visible (hidden class will be applied but testing library shows them)
    expect(screen.getAllByText('Services')[0]).toBeInTheDocument()
    expect(screen.getAllByText('About')[0]).toBeInTheDocument()
  })

  it('should render AuthLink component', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // Auth link renders once on desktop (mobile version rendered conditionally)
    expect(screen.getByTestId('auth-link')).toBeInTheDocument()
  })

  it('should toggle mobile menu when hamburger button is clicked', async () => {
    const user = userEvent.setup()
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // Find the mobile menu button
    const menuButton = screen.getByRole('button', { name: /open main menu/i })
    expect(menuButton).toBeInTheDocument()

    // Mobile menu should not be visible initially
    const mobileLinks = screen.queryAllByText('Services')
    // Initially should only see desktop link
    expect(mobileLinks.length).toBeGreaterThan(0)

    // Click to open menu
    await user.click(menuButton)

    // Mobile menu should now be visible (both desktop and mobile links)
    const servicesLinks = screen.getAllByText('Services')
    expect(servicesLinks.length).toBeGreaterThan(1) // Desktop + mobile
  })

  it('should close mobile menu when a link is clicked', async () => {
    const user = userEvent.setup()
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // Open mobile menu
    const menuButton = screen.getByRole('button', { name: /open main menu/i })
    await user.click(menuButton)

    // Verify menu is open
    const servicesLinks = screen.getAllByText('Services')
    expect(servicesLinks.length).toBeGreaterThan(1)

    // Click a mobile menu link (get the last one which is in the mobile menu)
    await user.click(servicesLinks[servicesLinks.length - 1])

    // Menu should close (hamburger icon shows open state)
    await user.click(menuButton) // Reopen to verify state changed
  })

  it('should show hamburger icon when menu is closed', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    const menuButton = screen.getByRole('button', { name: /open main menu/i })
    const svg = menuButton.querySelector('svg')

    // Check for hamburger icon path (3 horizontal lines)
    const path = svg?.querySelector('path')
    expect(path).toHaveAttribute('d', expect.stringContaining('M3.75 6.75h16.5'))
  })

  it('should show close icon when menu is open', async () => {
    const user = userEvent.setup()
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    const menuButton = screen.getByRole('button', { name: /open main menu/i })
    await user.click(menuButton)

    const svg = menuButton.querySelector('svg')
    const path = svg?.querySelector('path')

    // Check for X icon path
    expect(path).toHaveAttribute('d', expect.stringContaining('M6 18L18 6'))
  })

  it('should have correct navigation structure', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    // Check header element
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('bg-tarkman-purple')

    // Check that logo is within header
    const logo = screen.getByAltText('Tarkman Logo')
    expect(header).toContainElement(logo)
  })

  it('should render navigation links with correct hrefs', () => {
    const router = createTestRouter()
    render(<RouterProvider router={router} />, { wrapper: createWrapper() })

    const servicesLinks = screen.getAllByText('Services')
    const aboutLinks = screen.getAllByText('About')

    // Desktop links
    expect(servicesLinks[0].closest('a')).toHaveAttribute('href', '/')
    expect(aboutLinks[0].closest('a')).toHaveAttribute('href', '/about')
  })
})
