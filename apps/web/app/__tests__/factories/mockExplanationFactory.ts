import type { Explanation, Citation, ExplanationRating } from '@/types/explanation'

export function createMockExplanation(overrides: Partial<Explanation> = {}): Explanation {
  return {
    id: 1,
    title: 'The Lord\'s Prayer',
    description: 'This is the prayer that Jesus taught his disciples...',
    summary: 'A foundational prayer in Christian tradition',
    tags: ['theology', 'practice'],
    status: 1,
    average_rating: 4.5,
    rating_count: 10,
    view_count: 100,
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
    summary: `Summary for explanation ${i + 1}`,
    row_order: i + 1,
  }))
}

export function createMockCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: 1,
    citation_type: 0,
    text: 'Matthew 6:9-13',
    source: 'Gospel of Matthew',
    url: 'https://example.com/matthew/6',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockCitationList(count: number = 3): Citation[] {
  return Array.from({ length: count }, (_, i) => createMockCitation({
    id: i + 1,
    citation_type: (i % 3) as 0 | 1 | 2,
    text: `Citation ${i + 1}`,
    source: `Source ${i + 1}`,
  }))
}

export function createMockRating(overrides: Partial<ExplanationRating> = {}): ExplanationRating {
  return {
    id: 1,
    explanation_id: 1,
    user_id: 1,
    rating: 5,
    comment: 'Excellent explanation!',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockRatingList(count: number = 3): ExplanationRating[] {
  return Array.from({ length: count }, (_, i) => createMockRating({
    id: i + 1,
    user_id: i + 1,
    rating: Math.min(5, Math.max(1, 3 + (i % 3))),
    comment: `Comment ${i + 1}`,
  }))
}
