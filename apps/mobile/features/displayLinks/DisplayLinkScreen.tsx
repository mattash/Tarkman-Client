import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AppText } from '../../components/AppText'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { fetchDisplayLink } from './api'
import type { DisplayLinkConfig } from './config'

export interface DisplayLinkScreenProps {
  /** API base URL (already validated, no trailing slash). */
  apiBase: string
  /** Display-link token from the URL path. */
  token: string
  /** Override the fetch for tests; defaults to global fetch. */
  request?: typeof fetch
}

type Result =
  | { kind: 'invalid'; message: string }
  | { kind: 'loaded'; config: DisplayLinkConfig }

function displayKey(apiBase: string, token: string, request: typeof fetch | undefined): string {
  return `${apiBase}\u0000${token}\u0000${request ? 'custom' : 'global'}`
}

/**
 * The shell of the display mode: fetches the token's configuration and renders a
 * clear message on invalid/expired links instead of a blank screen. Projection UI
 * lands in follow-up PRs (#158).
 *
 * The result map is keyed by the display identity so token swaps during a session
 * never show a stale configuration and the loading hint can be derived without
 * synchronous setState in the effect body.
 */
export function DisplayLinkScreen({ apiBase, token, request }: DisplayLinkScreenProps) {
  const { t } = useI18n()
  const [results, setResults] = useState<Map<string, Result>>(new Map())
  const key = displayKey(apiBase, token, request)
  const current = results.get(key)

  const store = useCallback((next: Result) => {
    setResults(previous => {
      if (previous.get(key) === next) return previous
      const updated = new Map(previous)
      updated.set(key, next)
      return updated
    })
  }, [key])

  useEffect(() => {
    const controller = new AbortController()
    // Setter calls happen in async callbacks only; the empty-token branch defers
    // via queueMicrotask to keep the effect body free of synchronous setState.
    if (token === '') {
      queueMicrotask(() => { if (!controller.signal.aborted) store({ kind: 'invalid', message: t('display.invalidLink') }) })
      return () => controller.abort()
    }
    fetchDisplayLink(apiBase, token, request, controller.signal)
      .then(config => { if (!controller.signal.aborted) store({ kind: 'loaded', config }) })
      .catch(failure => {
        if (controller.signal.aborted) return
        store({ kind: 'invalid', message: failure instanceof Error ? failure.message : t('display.couldNotLoad') })
      })
    return () => controller.abort()
  }, [apiBase, token, request, t, store])

  if (current === undefined) {
    return <View testID="display-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
      <ActivityIndicator accessibilityLabel={t('display.loading')} />
    </View>
  }
  if (current.kind === 'invalid') {
    return <View testID="display-invalid" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
      <AppText variant="title">{t('display.invalidLink')}</AppText>
      {current.message !== t('display.invalidLink') && <AppText tone="muted">{current.message}</AppText>}
    </View>
  }
  // The projection UI lands in #158 PR2+; this PR renders a placeholder so the route exists end-to-end.
  return <View testID="display-loaded" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
    <AppText variant="eyebrow" tone="muted">{current.config.church_name ?? ''}</AppText>
    <AppText variant="title">{current.config.title ?? ''}</AppText>
  </View>
}
