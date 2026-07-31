import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { PartDetails } from '../PartDetails'
import { renderWithProviders } from '@/__tests__/utils/test-utils'
import { createMockExplanation, createMockPart } from '@/__tests__/factories'
import { fetchPart } from '@/queries/partQueries'
import { fetchExplanation } from '@/queries/explanationQueries'

vi.mock('@/queries/partQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/partQueries')>()
  return { ...actual, fetchPart: vi.fn() }
})

vi.mock('@/queries/explanationQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/explanationQueries')>()
  return { ...actual, fetchExplanation: vi.fn() }
})

vi.mock('../FastForwardButton', () => ({
  FastForwardButton: () => null,
}))

describe('PartDetails', () => {
  it('loads part details and explanations with the explicit session id', async () => {
    vi.mocked(fetchPart).mockResolvedValueOnce(
      createMockPart({ id: 7, explanation_ids: [3] }),
    )
    vi.mocked(fetchExplanation).mockResolvedValueOnce(
      createMockExplanation({
        id: 3,
        liturgy_id: 999,
        title: 'Why this prayer matters',
      }),
    )

    renderWithProviders(<PartDetails sessionId="42" partId={7} />)

    expect(await screen.findByText('Why this prayer matters')).toBeInTheDocument()
    expect(fetchPart).toHaveBeenCalledWith('42', 7)
    expect(fetchExplanation).toHaveBeenCalledWith('42', '3')
  })
})
