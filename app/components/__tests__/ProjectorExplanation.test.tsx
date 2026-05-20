import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectorExplanation } from '../ProjectorExplanation'
import { createMockExplanation } from '@/__tests__/factories/mockExplanationFactory'
import userEvent from '@testing-library/user-event'

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

// Mock useActionCable hook
vi.mock('@/hooks/useActionCable', () => ({
  useActionCable: vi.fn(() => null),
}))

describe('ProjectorExplanation', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should not render when isVisible is false', () => {
    const { container } = render(
      <ProjectorExplanation sessionId="1" isVisible={false} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    const overlayDiv = container.querySelector('.fixed.inset-0')
    expect(overlayDiv).not.toBeInTheDocument()
  })

  it('should render full-screen overlay when isVisible is true', async () => {
    const mockExplanation = createMockExplanation({
      title: 'Test Explanation',
      summary: 'Test summary',
      tags: ['theology', 'practice'],
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    const { container } = render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText('Test Explanation')).toBeInTheDocument()
    })

    // Check for full-screen overlay classes
    const overlayDiv = container.querySelector('.fixed.inset-0')
    expect(overlayDiv).toBeInTheDocument()
    expect(overlayDiv?.className).toContain('bg-opacity-90')
  })

  it('should display summary when available', async () => {
    const mockExplanation = createMockExplanation({
      summary: 'This is a test summary',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText('This is a test summary')).toBeInTheDocument()
    })
  })

  it('should display tags when available', async () => {
    const mockExplanation = createMockExplanation({
      tags: ['theology', 'history'],
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText('theology')).toBeInTheDocument()
      expect(screen.getByText('history')).toBeInTheDocument()
    })
  })

  it('should call onClose when ESC key is pressed', async () => {
    const mockExplanation = createMockExplanation()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText(mockExplanation.title)).toBeInTheDocument()
    })

    // Press ESC to close
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const mockExplanation = createMockExplanation()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText(mockExplanation.title)).toBeInTheDocument()
    })

    const closeButton = screen.getByLabelText(/hide explanation/i)
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not render during initial loading state', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) // Never resolves

    const { container } = render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    // Component doesn't render until explanations are loaded
    const overlayDiv = container.querySelector('.fixed')
    expect(overlayDiv).not.toBeInTheDocument()
  })

  it('should not render when there are no explanations', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [] }),
    })

    const { container } = render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      const projectorDiv = container.querySelector('.fixed')
      expect(projectorDiv).not.toBeInTheDocument()
    })
  })

  it('should display keyboard hint', async () => {
    const mockExplanation = createMockExplanation()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText(/press esc to close/i)).toBeInTheDocument()
    })
  })

  it('should display QR code section', async () => {
    const mockExplanation = createMockExplanation()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(screen.getByText('Read More')).toBeInTheDocument()
      expect(screen.getByText(/scan to view full explanation/i)).toBeInTheDocument()
    })
  })

  it('should use outline variant for tags', async () => {
    const mockExplanation = createMockExplanation({
      tags: ['theology'],
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ explanations: [{ explanation: mockExplanation }] }),
    })

    const { container } = render(
      <ProjectorExplanation sessionId="1" isVisible={true} onClose={mockOnClose} />,
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      const tagBadge = container.querySelector('.border')
      expect(tagBadge).toBeInTheDocument()
    })
  })
})
