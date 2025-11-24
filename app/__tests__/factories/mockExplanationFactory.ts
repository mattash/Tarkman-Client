import type { Explanation } from '@/types/explanation'

export function createMockExplanation(overrides: Partial<Explanation> = {}): Explanation {
  return {
    id: 1,
    title: 'The Lord\'s Prayer',
    description: 'This is the prayer that Jesus taught his disciples...',
    liturgy_id: 1,
    part_ids: [1],
    row_order: 1,
    user_id: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockExplanationList(count: number = 3): Explanation[] {
  return Array.from({ length: count }, (_, i) => createMockExplanation({
    id: i + 1,
    title: `Explanation ${i + 1}`,
    description: `This is explanation ${i + 1} about the liturgy...`,
    row_order: i + 1,
  }))
}
