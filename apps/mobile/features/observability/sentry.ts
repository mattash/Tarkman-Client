import { redactDisplayCapabilities } from '../displayLinks/privacy'
import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

export interface ObservabilityConfig {
  dsn?: string
  enabled: boolean
  environment: string
  tracesSampleRate: number
}

/** Reads configuration without acting on it, so the policy can be asserted in tests. */
export function observabilityConfig(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN, environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT): ObservabilityConfig {
  const candidate = typeof dsn === 'string' ? dsn.trim() : ''
  // A malformed value must not half-enable reporting; only a complete HTTPS DSN counts.
  const enabled = /^https:\/\/[0-9a-f]+@[^/\s@]+\/\d+$/i.test(candidate)
  const where = typeof environment === 'string' && environment.trim() ? environment.trim() : 'development'
  return {
    dsn: enabled ? candidate : undefined,
    enabled,
    environment: where,
    // Errors always report. Tracing samples only in production, so a service is never slowed for telemetry.
    tracesSampleRate: where === 'production' ? 0.1 : 0,
  }
}

/** Console output can contain anything a developer logged, including a reader's text. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null
  if (breadcrumb.data && 'Authorization' in breadcrumb.data) {
    const data = { ...breadcrumb.data }
    delete data.Authorization
    return redactDisplayCapabilities({ ...breadcrumb, data })
  }
  return redactDisplayCapabilities(breadcrumb)
}

/** Never send who the reader is or what their device sent; an error report only needs the failure. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed = { ...event }
  delete scrubbed.user
  delete scrubbed.request
  return redactDisplayCapabilities(scrubbed)
}

export function startObservability(config = observabilityConfig()): boolean {
  if (!config.enabled) return false
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
    beforeSendTransaction: event => redactDisplayCapabilities(event),
  })
  return true
}
