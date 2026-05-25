import type { SessionWrapper } from '@/types/session'

export function createMockSession(overrides: Partial<SessionWrapper['session']> = {}): SessionWrapper {
  return {
    session: {
      id: 1,
      date: '2025-01-15',
      liturgy: 'Divine Liturgy (Patarag)',
      liturgy_id: 1,
      liturgies: [
        { id: 1, name: 'Divine Liturgy (Patarag)', position: 1 }
      ],
      occupied: false,
      num_of_parts: 10,
      current_part_position: 0,
      current_part_id: 1,
      current_liturgy_id: 1,
      church_name: 'St. Mary',
      church_avatar: 'https://example.com/avatar.png',
      page: 1,
      posture: 'stand',
      readings: {
        gospel: 'John 3:16',
        epistle: 'Romans 8:28',
      },
      options: {
        gospel: 'John 3:16',
        epistle: 'Romans 8:28',
        before_message: 'Welcome to our service',
        after_message: 'Thank you for attending',
      },
      ...overrides,
    },
  }
}

export function createMockActiveSession(overrides: Partial<SessionWrapper['session']> = {}): SessionWrapper {
  return createMockSession({
    occupied: true,
    current_part_position: 3,
    current_part_id: 4,
    ...overrides,
  })
}

export function createMockSessionList(count: number = 3): SessionWrapper[] {
  return Array.from({ length: count }, (_, i) => createMockSession({
    id: i + 1,
    church_name: `Church ${i + 1}`,
    date: `2025-01-${String(15 + i).padStart(2, '0')}`,
  }))
}
