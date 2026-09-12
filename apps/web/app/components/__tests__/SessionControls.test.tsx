import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionControls } from '../SessionControls'
import { SessionWrapper } from '@/types/session'

// Mock the session queries
vi.mock('@/queries/sessions', async () => ({
  ...(await vi.importActual<typeof import('@/queries/sessions')>('@/queries/sessions')),
  sessionsKeys: {
    session: (id: string) => ['sessions', 'session', id],
    sessionParts: (id: string) => ['sessions', 'session', id, 'parts'],
  },
  sessionMutationKeys: {
    controls: (id: string) => ['sessionControls', id],
  },
  prevPart: vi.fn(),
  nextPart: vi.fn(),
  fetchSession: vi.fn(),
  updateSessionStatus: vi.fn(),
}))

import { prevPart, nextPart, fetchSession } from '@/queries/sessions'

const mockSession: SessionWrapper = {
  session: {
    id: 123,
    liturgy: 'Test liturgy',
    liturgy_id: 1,
    date: '2024-01-01',
    church_name: 'Test Church',
    church_avatar: '',
    occupied: false,
    num_of_parts: 3,
    current_part_position: 1,
    current_part_id: 1,
    current_liturgy_id: 1,
    liturgies: [],
    page: 1,
    posture: null,
    readings: { gospel: '', epistle: '' },
    options: { gospel: '', epistle: '', before_message: '', after_message: '' },
    status: 'active',
    status_message: null,
  },
}

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
    vi.mocked(fetchSession).mockResolvedValue(mockSession)
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
      expect(prevPart).toHaveBeenCalledWith('123', expect.any(String), 1)
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
      expect(nextPart).toHaveBeenCalledWith('123', expect.any(String), 1)
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
      expect(screen.getByLabelText('Next part')).toBeDisabled()
    })

    await user.click(screen.getByLabelText('Next part'))
    expect(nextPart).not.toHaveBeenCalled()

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
    vi.mocked(prevPart).mockRejectedValueOnce(new Error('Network error'))

    render(<SessionControls sessionId={123} />, {
      wrapper: createWrapper(),
    })

    const prevButton = screen.getByLabelText('Previous part')
    await user.click(prevButton)

    // Button should be re-enabled after error
    await waitFor(() => {
      expect(prevButton).not.toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The service position could not be updated. Please try again.',
      )
    })
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
      expect(nextPart).toHaveBeenCalledWith('456', expect.any(String), expect.anything())
    })
  })

  it('refreshes instead of moving the service when the server refuses a stale command', async () => {
    const refused = Object.assign(new Error('request failed'), {
      isAxiosError: true,
      response: { status: 409, data: { error: 'The current part changed', current_part_id: 130 } },
    })
    vi.mocked(fetchSession).mockResolvedValue(mockSession)
    vi.mocked(nextPart).mockRejectedValue(refused)

    render(<SessionControls sessionId={123} />, { wrapper: createWrapper() })
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByLabelText('Next part'))

    expect(await screen.findByText(/moved on somewhere else/)).toBeInTheDocument()
    // The refused move must not be retried, and the screen must pull the true position.
    expect(nextPart).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fetchSession).toHaveBeenCalledTimes(2))
  })

  it('says plainly when this account may not control the service', async () => {
    const refused = Object.assign(new Error('request failed'), {
      isAxiosError: true,
      response: { status: 403, data: { error: 'You do not have permission' } },
    })
    vi.mocked(fetchSession).mockResolvedValue(mockSession)
    vi.mocked(nextPart).mockRejectedValue(refused)

    render(<SessionControls sessionId={123} />, { wrapper: createWrapper() })
    await userEvent.click(screen.getByLabelText('Next part'))

    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument()
  })
})
