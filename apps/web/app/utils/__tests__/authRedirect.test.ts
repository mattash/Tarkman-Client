import { describe, expect, it } from 'vitest'
import { getSafeRedirectPath } from '../authRedirect'

describe('getSafeRedirectPath', () => {
  it('preserves an internal path, query, and hash', () => {
    expect(getSafeRedirectPath('/dashboard?tab=service#controls')).toBe(
      '/dashboard?tab=service#controls',
    )
  })

  it.each([
    undefined,
    '',
    'https://example.com/dashboard',
    '//example.com/dashboard',
    '/login',
  ])('falls back to home for unsafe destination %s', (destination) => {
    expect(getSafeRedirectPath(destination)).toBe('/')
  })
})
