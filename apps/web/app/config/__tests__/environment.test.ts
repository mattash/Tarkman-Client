import { describe, expect, it } from 'vitest'
import { getRequiredEnvironmentVariable } from '@/config/environment'

describe('getRequiredEnvironmentVariable', () => {
  it('returns a configured value byte-for-byte', () => {
    expect(
      getRequiredEnvironmentVariable('VITE_API_URL', { VITE_API_URL: ' https://example.test/ ' }),
    ).toBe(' https://example.test/ ')
  })

  it('throws a safe error when the key is missing', () => {
    expect(() => getRequiredEnvironmentVariable('VITE_API_URL', {})).toThrow(
      'Missing required environment variable: VITE_API_URL',
    )
  })

  it('throws a safe error for an empty value', () => {
    expect(() => getRequiredEnvironmentVariable('VITE_API_URL', { VITE_API_URL: '' })).toThrow(
      'Missing required environment variable: VITE_API_URL',
    )
  })

  it('throws a safe error for a whitespace-only value', () => {
    expect(() => getRequiredEnvironmentVariable('VITE_API_URL', { VITE_API_URL: '   ' })).toThrow(
      'Missing required environment variable: VITE_API_URL',
    )
  })

  it('never includes the supplied value in an error', () => {
    const suppliedValue = 'super-secret-value'
    let thrownError: unknown

    try {
      getRequiredEnvironmentVariable('VITE_API_URL', { VITE_API_URL: { suppliedValue } })
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toBeInstanceOf(Error)
    expect((thrownError as Error).message).not.toContain(suppliedValue)
  })
})
