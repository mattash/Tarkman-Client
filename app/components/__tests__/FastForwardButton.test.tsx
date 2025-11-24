import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FastForwardButton } from '../FastForwardButton'
import { createMockUser } from '../../__tests__/factories'

// Mock dependencies
const mockSetPart = vi.fn()
vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    session: (id: string) => ['sessions', 'session', id],
  },
  setPart: (...args: any[]) => mockSetPart(...args),
}))

// Mock AuthContext
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('FastForwardButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render nothing if user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null })

    render(<FastForwardButton sessionId="123" partId={456} />, {
      wrapper: createWrapper(),
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should render button if user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: createMockUser() })

    render(<FastForwardButton sessionId="123" partId={456} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByRole('button', { name: /fast forward/i })).toBeInTheDocument()
  })

  it('should call setPart mutation when clicked', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({ user: createMockUser() })
    mockSetPart.mockResolvedValue({ success: true })

    render(<FastForwardButton sessionId="123" partId={456} />, {
      wrapper: createWrapper(),
    })

    const button = screen.getByRole('button', { name: /fast forward/i })
    await user.click(button)

    await waitFor(() => {
      expect(mockSetPart).toHaveBeenCalledWith('123', 456)
    })
  })

  it('should show loading state while mutation is pending', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({ user: createMockUser() })
    
    // Create a promise that we can control
    let resolveMutation: (value: any) => void
    mockSetPart.mockImplementation(() => new Promise(resolve => {
      resolveMutation = resolve
    }))

    render(<FastForwardButton sessionId="123" partId={456} />, {
      wrapper: createWrapper(),
    })

    const button = screen.getByRole('button', { name: /fast forward/i })
    await user.click(button)

    // Check loading state
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Setting...')
    expect(button).toHaveClass('cursor-not-allowed')

    // Resolve mutation
    await act(async () => {
      resolveMutation({ success: true })
    })

    await waitFor(() => {
      expect(button).not.toBeDisabled()
      expect(button).toHaveTextContent('Fast Forward')
    })
  })
})

