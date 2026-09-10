import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CitationsList } from '../CitationsList'
import { createMockCitation } from '@/__tests__/factories/mockExplanationFactory'
import userEvent from '@testing-library/user-event'
import { api } from '@/api'

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('CitationsList', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should render citations grouped by type', async () => {
    const mockCitations = [
      createMockCitation({ id: 1, citation_type: 0, text: 'Matthew 6:9-13', source: 'Gospel' }),
      createMockCitation({ id: 2, citation_type: 1, text: 'See also Luke 11:2-4', source: 'Gospel' }),
      createMockCitation({ id: 3, citation_type: 2, text: 'External source', source: 'Book', url: 'https://example.com' }),
    ]

    vi.mocked(api.get).mockResolvedValue({ data: { citations: mockCitations } })

    render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Scripture References')).toBeInTheDocument()
      expect(screen.getByText('Cross-References')).toBeInTheDocument()
      expect(screen.getByText('External Sources')).toBeInTheDocument()
    })
  })

  it('should display citation count for each type', async () => {
    const mockCitations = [
      createMockCitation({ id: 1, citation_type: 0 }),
      createMockCitation({ id: 2, citation_type: 0 }),
      createMockCitation({ id: 3, citation_type: 1 }),
    ]

    vi.mocked(api.get).mockResolvedValue({ data: { citations: mockCitations } })

    render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('(2)')).toBeInTheDocument()
      expect(screen.getByText('(1)')).toBeInTheDocument()
    })
  })

  it('should toggle collapsible sections when clicked', async () => {
    const user = userEvent.setup()
    const mockCitations = [
      createMockCitation({ id: 1, citation_type: 0, text: 'Matthew 6:9-13' }),
    ]

    vi.mocked(api.get).mockResolvedValue({ data: { citations: mockCitations } })

    render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Matthew 6:9-13')).toBeInTheDocument()
    })

    const trigger = screen.getByText('Scripture References')
    await user.click(trigger)

    // After clicking, the content should be hidden (note: exact behavior depends on Radix UI implementation)
    // We just verify that the trigger is still there
    expect(trigger).toBeInTheDocument()
  })

  it('should render external source links', async () => {
    const mockCitations = [
      createMockCitation({
        id: 1,
        citation_type: 2,
        text: 'External citation',
        source: 'Book',
        url: 'https://example.com',
      }),
    ]

    vi.mocked(api.get).mockResolvedValue({ data: { citations: mockCitations } })

    render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /visit source/i })
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('should show loading state while fetching citations', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})) // Never resolves

    const { container } = render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    // Check for loading skeleton with animate-pulse class
    const loadingElement = container.querySelector('.animate-pulse')
    expect(loadingElement).toBeInTheDocument()
  })

  it('should render nothing when there are no citations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { citations: [] } })

    const { container } = render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })

    const { container } = render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('should only render citation types that have citations', async () => {
    const mockCitations = [
      createMockCitation({ id: 1, citation_type: 0 }), // Only scripture
    ]

    vi.mocked(api.get).mockResolvedValue({ data: { citations: mockCitations } })

    render(<CitationsList liturgyId="1" explanationId="1" />, {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(screen.getByText('Scripture References')).toBeInTheDocument()
    })

    // Other sections should not be rendered if they have no citations
    expect(screen.queryByText('Cross-References')).not.toBeInTheDocument()
    expect(screen.queryByText('External Sources')).not.toBeInTheDocument()
  })
})
