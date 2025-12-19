import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionStatusControl } from '../SessionStatusControl'

vi.mock('@/queries/sessions', () => ({
  sessionsKeys: {
    session: (id: string) => ['sessions', 'session', id]
  },
  updateSessionStatus: vi.fn()
}))

import { updateSessionStatus } from '@/queries/sessions'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('SessionStatusControl', () => {
  it('should render dropdown button with current status', () => {
    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })
    expect(screen.getByLabelText('Change session status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('should render dropdown button with default active status when not provided', () => {
    render(<SessionStatusControl sessionId={123} />, {
      wrapper: createWrapper()
    })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('should open dropdown when button clicked', async () => {
    const user = userEvent.setup()
    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Gospel Reading')).toBeInTheDocument()
    expect(screen.getByText('Epistle Reading')).toBeInTheDocument()
    expect(screen.getByText('Welcome Message')).toBeInTheDocument()
    expect(screen.getByText('Custom Announcement')).toBeInTheDocument()
  })

  it('should update status when option selected', async () => {
    const user = userEvent.setup()
    vi.mocked(updateSessionStatus).mockResolvedValueOnce({
      status: 'Session status updated',
      current_status: 'paused',
      status_message: null
    })

    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))
    await user.click(screen.getByText('Paused'))

    await waitFor(() => {
      expect(updateSessionStatus).toHaveBeenCalledWith('123', { status: 'paused' })
    })
  })

  it('should open custom message modal when custom announcement selected', async () => {
    const user = userEvent.setup()
    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))
    await user.click(screen.getByText('Custom Announcement'))

    expect(screen.getByText('Custom Announcement')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter your custom message/)).toBeInTheDocument()
  })

  it('should submit custom message when modal form submitted', async () => {
    const user = userEvent.setup()
    vi.mocked(updateSessionStatus).mockResolvedValueOnce({
      status: 'Session status updated',
      current_status: 'showing_custom',
      status_message: 'Test message'
    })

    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))
    await user.click(screen.getByText('Custom Announcement'))

    const textarea = screen.getByPlaceholderText(/Enter your custom message/)
    await user.type(textarea, 'Test message')

    await user.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(updateSessionStatus).toHaveBeenCalledWith('123', {
        status: 'showing_custom',
        status_message: 'Test message'
      })
    })
  })

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <div>
        <SessionStatusControl sessionId={123} currentStatus="active" />
        <div data-testid="outside">Outside</div>
      </div>,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByLabelText('Change session status'))
    expect(screen.getByText('Paused')).toBeInTheDocument()

    const outsideElement = screen.getByTestId('outside')
    await user.click(outsideElement)

    await waitFor(() => {
      expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    })
  })

  it('should disable button during pending mutation', async () => {
    const user = userEvent.setup()
    vi.mocked(updateSessionStatus).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    )

    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))
    const pausedButton = screen.getByText('Paused')
    await user.click(pausedButton)

    await waitFor(() => {
      const button = screen.getByLabelText('Change session status')
      expect(button).toBeDisabled()
    })
  })

  it('should highlight current status in dropdown', async () => {
    const user = userEvent.setup()
    render(<SessionStatusControl sessionId={123} currentStatus="paused" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))

    const pausedOption = screen.getAllByText('Paused').find(el => el.tagName === 'BUTTON')
    expect(pausedOption).toHaveClass('font-semibold')
  })

  it('should log error when status update fails', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(updateSessionStatus).mockRejectedValueOnce(new Error('Network error'))

    render(<SessionStatusControl sessionId={123} currentStatus="active" />, {
      wrapper: createWrapper()
    })

    await user.click(screen.getByLabelText('Change session status'))
    await user.click(screen.getByText('Paused'))

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update status:',
        expect.any(Error)
      )
    })

    consoleErrorSpy.mockRestore()
  })
})
