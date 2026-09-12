import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionControls } from '../SessionControls'
import * as sessions from '@/queries/sessions'

vi.mock('@/queries/sessions', async () => {
  const actual = await vi.importActual<typeof sessions>('@/queries/sessions')
  return { ...actual, fetchSession: vi.fn(), nextPart: vi.fn(), prevPart: vi.fn(), updateSessionStatus: vi.fn() }
})

const session = { session: { id: 1, liturgy: 'Divine Liturgy', current_part_id: 123, status: 'active' } }
const refused = (status: number, data: unknown) =>
  Object.assign(new Error('request failed'), { isAxiosError: true, response: { status, data } })

function renderControls() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><SessionControls sessionId={1} /></QueryClientProvider>)
  return client
}

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessions.fetchSession).mockResolvedValue(session as never)
  })

  it('tells the server which part it believes the service is on', async () => {
    vi.mocked(sessions.nextPart).mockResolvedValue({ status: 'ok', current_part_id: 124 } as never)
    renderControls()
    await screen.findByLabelText('Next part')
    await waitFor(() => expect(sessions.fetchSession).toHaveBeenCalled())
    await userEvent.click(screen.getByLabelText('Next part'))
    await waitFor(() => expect(sessions.nextPart).toHaveBeenCalledWith('1', expect.any(String), 123))
  })

  it('refreshes instead of moving the service when the server refuses a stale command', async () => {
    vi.mocked(sessions.nextPart).mockRejectedValue(refused(409, { error: 'The current part changed', current_part_id: 130 }))
    renderControls()
    await waitFor(() => expect(sessions.fetchSession).toHaveBeenCalledTimes(1))
    await userEvent.click(await screen.findByLabelText('Next part'))
    expect(await screen.findByText(/moved on somewhere else/)).toBeInTheDocument()
    // The refused move must not be retried, and the screen must pull the true position.
    expect(sessions.nextPart).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(sessions.fetchSession).toHaveBeenCalledTimes(2))
  })

  it('says plainly when this account may not control the service', async () => {
    vi.mocked(sessions.nextPart).mockRejectedValue(refused(403, { error: 'You do not have permission' }))
    renderControls()
    await userEvent.click(await screen.findByLabelText('Next part'))
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument()
  })
})
