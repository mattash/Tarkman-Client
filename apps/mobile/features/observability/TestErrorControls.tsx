import { useState } from 'react'
import * as Sentry from '@sentry/react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { observabilityConfig, type ObservabilityConfig } from './sentry'

/** Deliberate errors prove release symbolication end to end; never offered to readers of a production build. */
export function showsTestErrorControls(config: ObservabilityConfig, isDevelopment: boolean): boolean {
  return isDevelopment || config.environment === 'preview'
}

export function TestErrorControls({ config = observabilityConfig(), isDevelopment = __DEV__ }: { config?: ObservabilityConfig; isDevelopment?: boolean }) {
  const [sent, setSent] = useState<string>()
  if (!showsTestErrorControls(config, isDevelopment)) return null
  return <>
    <AppText tone="muted">{config.enabled ? `Reporting to Sentry as "${config.environment}".` : 'No Sentry DSN is configured, so nothing is reported.'}</AppText>
    <AppButton variant="secondary" size="card" disabled={!config.enabled} onPress={() => {
      setSent(Sentry.captureException(new Error('Tarkman controlled test error')))
    }}>Send a test error</AppButton>
    {sent && <AppText variant="caption" accessibilityLiveRegion="polite">{`Sent. Event ${sent}.`}</AppText>}
    <AppButton variant="destructive" size="card" disabled={!config.enabled} onPress={() => Sentry.nativeCrash()}>Crash the app (native)</AppButton>
    <AppText variant="caption" tone="muted">The native crash closes the app; it is reported when the app next opens.</AppText>
  </>
}
