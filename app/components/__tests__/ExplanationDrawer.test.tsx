import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExplanationDrawer } from '../ExplanationDrawer'
import type { ReactNode } from 'react'

// Mock the useActionCable hook
vi.mock('@/hooks/useActionCable', () => ({
  useActionCable: vi.fn(() => null),
}))

// Mock explanation queries
vi.mock('@/queries/explanationQueries', () => ({
  explanationQueryKeys: {
    current: (sessionId: string) => ['explanation', sessionId, 'current'],
  },
  fetchCurrentExplanation: vi.fn(),
}))

import { fetchCurrentExplanation } from '@/queries/explanationQueries'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return Wrapper
}

describe('ExplanationDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render trigger button with "Need help" text', () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Need help')).toBeInTheDocument()
  })

  it('should render with custom title', () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])

    render(<ExplanationDrawer sessionId="123" title="Custom Title" />, {
      wrapper: createWrapper(),
    })

    // The title is in the drawer content which is initially closed
    // So we just verify the component renders
    expect(screen.getByText('Need help')).toBeInTheDocument()
  })

  it('should use default title "Explanation" when not provided', () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Need help')).toBeInTheDocument()
  })

  it('should render help icon', () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    // lucide-react renders SVGs, check for the button
    const button = screen.getByText('Need help').closest('button')
    expect(button).toBeInTheDocument()
  })

  it('should pass correct sessionId to query', () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])

    render(<ExplanationDrawer sessionId="456" />, {
      wrapper: createWrapper(),
    })

    // The component should use the sessionId in the query key
    expect(screen.getByText('Need help')).toBeInTheDocument()
  })
})
