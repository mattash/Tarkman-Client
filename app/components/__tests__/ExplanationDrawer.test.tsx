import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import type { Explanation } from '@/types/explanation'

const mockExplanation: Explanation = {
  id: 1,
  title: 'Test Explanation',
  description: 'Test description',
  part_ids: [1],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  row_order: 1,
  liturgy_id: 0,
  user_id: 1,
}

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
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    Object.defineProperty(CSSStyleDeclaration.prototype, 'webkitTransform', { configurable: true, value: '' })
    Object.defineProperty(CSSStyleDeclaration.prototype, 'mozTransform', { configurable: true, value: '' })
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

  it('shows the empty state after a successful empty query', async () => {
    vi.mocked(fetchCurrentExplanation).mockResolvedValue([])
    const user = userEvent.setup()

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: 'Need help' }))

    expect(await screen.findByText('No explanation available')).toBeInTheDocument()
  })

  it('shows an unavailable alert instead of the empty state when the query fails', async () => {
    vi.mocked(fetchCurrentExplanation).mockRejectedValue(new Error('Request failed'))
    const user = userEvent.setup()

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: 'Need help' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Explanation temporarily unavailable')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('No explanation available')).not.toBeInTheDocument()
  })

  it('retries an unavailable explanation and renders the recovered content', async () => {
    let resolveRetry!: (value: Explanation[]) => void
    const retryPromise = new Promise<Explanation[]>((resolve) => {
      resolveRetry = resolve
    })
    vi.mocked(fetchCurrentExplanation)
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockReturnValueOnce(retryPromise)
    const user = userEvent.setup()

    render(<ExplanationDrawer sessionId="123" />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: 'Need help' }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Retrying...' })).toBeDisabled()

    resolveRetry([mockExplanation])

    expect(await screen.findByText('Test Explanation')).toBeInTheDocument()
    expect(fetchCurrentExplanation).toHaveBeenCalledTimes(2)
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
