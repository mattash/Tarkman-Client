import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExplanationIndicator } from '../ExplanationIndicator'
import { createMockExplanation } from '@/__tests__/factories/mockExplanationFactory'
import { explanationQueryKeys } from '@/queries/explanationQueries'

vi.mock('@/hooks/usePusher', () => ({
  usePusher: vi.fn(() => null),
}))

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

describe('ExplanationIndicator', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows QR when explanations first become available', async () => {
    const queryClient = createQueryClient()
    const initialExplanation = createMockExplanation({
      updated_at: '2025-01-01T00:00:00Z',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          explanations: [{ explanation: initialExplanation }],
        }),
    })

    queryClient.setQueryData(explanationQueryKeys.current('1'), [initialExplanation])

    render(<ExplanationIndicator sessionId="1" qrDurationMs={500} />, {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(screen.getByText(/scan/i)).toBeInTheDocument()
    })
  })

  it('shows QR when a new explanation arrives and hides after 20 seconds', async () => {
    const queryClient = createQueryClient()

    const firstExplanation = createMockExplanation({
      updated_at: '2025-01-01T00:00:00Z',
    })
    const newExplanation = createMockExplanation({
      id: firstExplanation.id + 1,
      updated_at: '2025-01-01T00:00:20Z',
    })

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            explanations: [{ explanation: firstExplanation }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            explanations: [{ explanation: newExplanation }],
          }),
      })

    queryClient.setQueryData(explanationQueryKeys.current('1'), [firstExplanation])

    render(<ExplanationIndicator sessionId="1" qrDurationMs={500} />, {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/explanation indicator/i)).toBeInTheDocument()
    })

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current('1') })
    })

    await waitFor(() => {
      expect(screen.getByText(/scan/i)).toBeInTheDocument()
      expect(screen.getByText(/sessions\/1\/explanations/i)).toBeInTheDocument()
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })

    await waitFor(() => {
      expect(screen.queryByText(/scan/i)).not.toBeInTheDocument()
    })
  })

  it('returns null when enabled is false but still calls all hooks', () => {
    const queryClient = createQueryClient()

    render(<ExplanationIndicator sessionId="1" enabled={false} />, {
      wrapper: createWrapper(queryClient),
    })

    // When enabled is false, the component should return null
    // and should NOT have the explanation indicator in the DOM
    expect(screen.queryByLabelText(/explanation indicator/i)).not.toBeInTheDocument()
    // The query should not be active (enabled=false gates it)
    const queryState = queryClient.getQueryState(explanationQueryKeys.current('1'))
    // When enabled=false, the query exists in pending state but is not active
    expect(queryState?.fetchStatus).toBe('idle')
  })
})
