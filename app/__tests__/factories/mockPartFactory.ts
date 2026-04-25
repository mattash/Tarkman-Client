import type { PartWrapper } from '@/types/part'

export function createMockPart(overrides: Partial<PartWrapper['part']> = {}): PartWrapper {
  return {
    part: {
      id: 1,
      liturgy_part_id: 1,
      role: 'priest',
      grabar: 'Հայր մեր, որ յերկինս ես',
      translit: 'Hayr mer, vor y yerkinus yes',
      hy_east: null,
      hy_west: null,
      ru: 'Отче наш, сущий на небесах',
      en: 'Our Father, who art in heaven',
      posture: 'stand',
      duration_type: 'default',
      page: 1,
      explanation_ids: [],
      effective_duration_ms: 5000,
      position: 1,
      sheet_music: null,
      assignment: null,
      ...overrides,
    },
  }
}

export function createMockPartWithExplanations(overrides: Partial<PartWrapper['part']> = {}): PartWrapper {
  return createMockPart({
    explanation_ids: [1, 2],
    ...overrides,
  })
}

export function createMockPartList(count: number = 5): PartWrapper[] {
  return Array.from({ length: count }, (_, i) => createMockPart({
    id: i + 1,
    liturgy_part_id: i + 100,
    position: i + 1,
    role: i % 2 === 0 ? 'priest' : 'choir',
    page: Math.floor(i / 2) + 1,
    effective_duration_ms: 3000 + i * 1000,
  }))
}
