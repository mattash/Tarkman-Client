import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionControls } from '../SessionControls'

// Mock the session queries
vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    session: (id: string) => ['sessions', 'session', id],
  },
  prevPart: vi.fn(),
  nextPart: vi.fn(),
}))

import { prevPart, nextPart } from '@/queries/sessions'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render previous and next buttons', () => {
    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByLabelText('Previous part')).toBeInTheDocument()
    expect(screen.getByLabelText('Next part')).toBeInTheDocument()
  })

  it('should call prevPart when previous button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(prevPart).mockResolvedValueOnce({
      status: 'success',
      current_part_id: 122,
    })

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const prevButton = screen.getByLabelText('Previous part')
    await user.click(prevButton)

    await waitFor(() => {
      expect(prevPart).toHaveBeenCalledWith('123')
    })
  })

  it('should call nextPart when next button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(nextPart).mockResolvedValueOnce({
      status: 'success',
      current_part_id: 124,
    })

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const nextButton = screen.getByLabelText('Next part')
    await user.click(nextButton)

    await waitFor(() => {
      expect(nextPart).toHaveBeenCalledWith('123')
    })
  })

  it('should disable previous button while mutation is pending', async () => {
    const user = userEvent.setup()
    let resolvePrevPart: (value: any) => void

    vi.mocked(prevPart).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrevPart = resolve
        })
    )

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const prevButton = screen.getByLabelText('Previous part')

    await user.click(prevButton)

    // Button should be disabled while pending
    await waitFor(() => {
      expect(prevButton).toBeDisabled()
    })

    // Resolve the mutation
    resolvePrevPart!({ status: 'success', current_part_id: 122 })

    // Button should be enabled again
    await waitFor(() => {
      expect(prevButton).not.toBeDisabled()
    })
  })

  it('should disable next button while mutation is pending', async () => {
    const user = userEvent.setup()
    let resolveNextPart: (value: any) => void

    vi.mocked(nextPart).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNextPart = resolve
        })
    )

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const nextButton = screen.getByLabelText('Next part')

    await user.click(nextButton)

    // Button should be disabled while pending
    await waitFor(() => {
      expect(nextButton).toBeDisabled()
    })

    // Resolve the mutation
    resolveNextPart!({ status: 'success', current_part_id: 124 })

    // Button should be enabled again
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled()
    })
  })

  it('should handle errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(prevPart).mockRejectedValueOnce(new Error('Network error'))

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const prevButton = screen.getByLabelText('Previous part')
    await user.click(prevButton)

    // Button should be re-enabled after error
    await waitFor(() => {
      expect(prevButton).not.toBeDisabled()
    })

    consoleError.mockRestore()
  })

  it('should render with correct styling classes', () => {
    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const prevButton = screen.getByLabelText('Previous part')
    const nextButton = screen.getByLabelText('Next part')

    expect(prevButton).toHaveClass('bg-blue-500', 'text-white', 'rounded')
    expect(nextButton).toHaveClass('bg-blue-500', 'text-white', 'rounded')
  })

  it('should convert sessionId to string when calling API', async () => {
    const user = userEvent.setup()
    vi.mocked(nextPart).mockResolvedValueOnce({
      status: 'success',
      current_part_id: 124,
    })

    render(<SessionControls sessionId={456} />, {
      wrapper: createWrapper(),
    })

    const nextButton = screen.getByLabelText('Next part')
    await user.click(nextButton)

    await waitFor(() => {
      expect(nextPart).toHaveBeenCalledWith('456')
    })
  })
})
