import { expect, it, jest } from '@jest/globals'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'
import { observabilityConfig, scrubBreadcrumb, scrubEvent, startObservability } from '../features/observability/sentry'

const DSN = 'https://4afb94a821c164ca67e79f7af36fbb36@o4508168441298944.ingest.us.sentry.io/4512071039188992'

it('reports only with a complete DSN, and stays silent otherwise', () => {
  expect(observabilityConfig(DSN, 'production')).toMatchObject({ enabled: true, dsn: DSN, environment: 'production' })
  for (const broken of [undefined, '', '   ', 'not-a-dsn', 'http://key@host/1', 'https://key@host', DSN.replace('/4512071039188992', '')]) {
    expect(observabilityConfig(broken, 'production').enabled).toBe(false)
  }
})

it('names the environment and samples traces only in production', () => {
  expect(observabilityConfig(DSN, undefined).environment).toBe('development')
  expect(observabilityConfig(DSN, '  ').environment).toBe('development')
  expect(observabilityConfig(DSN, 'development').tracesSampleRate).toBe(0)
  expect(observabilityConfig(DSN, 'preview').tracesSampleRate).toBe(0)
  expect(observabilityConfig(DSN, 'production').tracesSampleRate).toBe(0.1)
})

it('keeps console output and bearer tokens out of what is sent', () => {
  expect(scrubBreadcrumb({ category: 'console', message: 'reader text' } as Breadcrumb)).toBeNull()
  expect(scrubBreadcrumb({ category: 'http', data: { Authorization: 'Bearer jwt', url: '/s/9.json' } } as Breadcrumb))
    .toEqual({ category: 'http', data: { url: '/s/9.json' } })
  const event = { message: 'boom', user: { email: 'reader@example.test' }, request: { headers: { Authorization: 'Bearer jwt' } } } as unknown as ErrorEvent
  expect(scrubEvent(event)).toEqual({ message: 'boom' })
})

it('does not start reporting when no DSN is configured', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(startObservability({ enabled: false, environment: 'development', tracesSampleRate: 0 })).toBe(false)
  warn.mockRestore()
})
