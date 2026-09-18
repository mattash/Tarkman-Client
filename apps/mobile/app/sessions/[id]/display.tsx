import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppText } from '../../../components/AppText'
import { spacing } from '../../../design/tokens'
import { readerConfig } from '../../../features/live/config'
import { fetchDisplayLink } from '../../../features/displayLinks/api'
import { DisplayProjection } from '../../../features/displayLinks/DisplayProjection'
import type { DisplayLinkConfig } from '../../../features/displayLinks/config'
import { useI18n } from '../../../features/i18n'

type State = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'loaded'; config: DisplayLinkConfig }

/**
 * Named-service display route at `/sessions/:id/display?token=...`, mirroring
 * the web's canonical shape (session id in the path, display-link token as a
 * search parameter carrying preferences).
 */
export default function DisplaySessionRoute() {
  const { id, token } = useLocalSearchParams<{ id?: string; token?: string }>()
  const { t } = useI18n()
  const config = readerConfig()
  const sessionId = Number(id)
  const validId = Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : null
  const apiBase = config.endpoints?.api
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (apiBase === undefined || token === undefined || token === '' || validId === null) return
    const controller = new AbortController()
    fetchDisplayLink(apiBase, token, globalThis.fetch, controller.signal)
      .then(serverConfig => { if (!controller.signal.aborted) setState({ kind: 'loaded', config: serverConfig }) })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'invalid' }) })
    return () => controller.abort()
  }, [apiBase, token, validId])

  if (!config.endpoints) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
      <AppText variant="title">{config.error}</AppText>
    </ScrollView>
  }
  if (state.kind === 'invalid' || token === undefined || token === '' || validId === null) {
    return <ScrollView testID="display-invalid" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center', flexGrow: 1, justifyContent: 'center' }}>
      <AppText variant="title">{t('display.invalidLink')}</AppText>
    </ScrollView>
  }
  if (state.kind === 'loading') {
    return <ScrollView testID="display-loading" contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
      <AppText tone="muted">{t('display.loading')}</AppText>
    </ScrollView>
  }
  return <DisplayProjection apiBase={apiBase!} cableBase={config.endpoints.cable} config={state.config} sessionId={validId} />
}
