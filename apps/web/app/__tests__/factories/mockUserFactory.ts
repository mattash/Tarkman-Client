import type { User } from '@/types/auth'

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    roles: [],
    ...overrides,
  }
}

export function createMockAdminUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    email: 'admin@example.com',
    roles: ['admin'],
    ...overrides,
  })
}

export function createMockEditorUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    email: 'editor@example.com',
    roles: ['editor'],
    ...overrides,
  })
}
