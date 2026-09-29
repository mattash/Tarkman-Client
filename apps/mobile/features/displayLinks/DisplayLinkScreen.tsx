import { useCallback } from 'react'
import { useI18n } from '../i18n'
import type { Endpoints } from '../live/config'
import { fetchCurrentDisplaySession } from './api'
import { DEFAULT_DISPLAY_CONFIG, type DisplayPreferences } from './config'
import { normalizeOverrides } from './normalize'
import { DisplayFrame, DisplayNotice } from './DisplayFrame'
import { DisplayProjection } from './DisplayProjection'
import { useTokenConfig } from './useTokenConfig'
import { useDisplayResource } from './useDisplayResource'

export type DisplayParams = Record<string, string | string[] | undefined>
export function displayId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}
export function DisplayLinkScreen({ endpoints, params, named = false, statusOnly = false, request = fetch }: {
  endpoints: Endpoints; params: DisplayParams; named?: boolean; statusOnly?: boolean; request?: typeof fetch
}) {
  const { t } = useI18n()
  const id = named ? displayId(params.id) : null
  const token = typeof params.token === 'string' ? params.token.trim() : undefined
  const invalid = (named && id === null) || (params.token !== undefined && !token) ||
    (!named && !token && params.user_id !== undefined && displayId(params.user_id) === null)
  return <DisplayFrame>{invalid ? <DisplayNotice testID="display-invalid" title={t('display.invalidLink')} detail={t('display.replaceLink')} />
    : token ? <TokenDisplay key={`${endpoints.api}/${token}/${id}/${statusOnly}`} endpoints={endpoints} token={token} sessionId={id} statusOnly={statusOnly} request={request} />
    : <ResolvedDisplay endpoints={endpoints} sessionId={id} statusOnly={statusOnly}
      preferences={{ ...DEFAULT_DISPLAY_CONFIG, ...normalizeOverrides(params) }}
      userId={displayId(params.user_id) ?? displayId(process.env.EXPO_PUBLIC_DEFAULT_CHURCH_ID) ?? 2} request={request} />}
  </DisplayFrame>
}
function TokenDisplay({ endpoints, token, sessionId, statusOnly, request }: {
  endpoints: Endpoints; token: string; sessionId: number | null; statusOnly: boolean; request: typeof fetch
}) {
  const { t } = useI18n()
  const result = useTokenConfig(endpoints, token, request)
  if (result.terminal) return <DisplayNotice testID="display-invalid" title={t('display.invalidLink')} detail={t('display.replaceLink')} />
  if (!result.data) return <DisplayNotice testID="display-loading" busy={!result.error} title={t(result.error ? 'display.couldNotLoad' : 'display.loading')} detail={result.error ? t('display.retrying') : undefined} />
  // The normalized stored preferences are authoritative, including defaults for malformed values.
  return <ResolvedDisplay endpoints={endpoints} preferences={result.data} userId={result.data.user_id} sessionId={sessionId} statusOnly={statusOnly} request={request} />
}
function ResolvedDisplay({ endpoints, preferences, userId, sessionId, statusOnly, request }: {
  endpoints: Endpoints; preferences: DisplayPreferences; userId: number; sessionId: number | null; statusOnly: boolean; request: typeof fetch
}) {
  if (sessionId !== null) return <DisplayProjection key={sessionId} apiBase={endpoints.api} cableBase={endpoints.cable} config={preferences} sessionId={sessionId} statusOnly={statusOnly} />
  return <CurrentDisplay key={`${endpoints.api}/${userId}`} endpoints={endpoints} preferences={preferences} userId={userId} statusOnly={statusOnly} request={request} />
}
function CurrentDisplay({ endpoints, preferences, userId, statusOnly, request }: {
  endpoints: Endpoints; preferences: DisplayPreferences; userId: number; statusOnly: boolean; request: typeof fetch
}) {
  const { t } = useI18n()
  const load = useCallback((signal: AbortSignal) => fetchCurrentDisplaySession(endpoints.api, userId, signal, request), [endpoints.api, userId, request])
  const result = useDisplayResource(`${endpoints.api}/${userId}`, load, 5000)
  if (!result.data) return <DisplayNotice testID="display-waiting" busy={result.data === undefined && !result.error}
    title={t(result.error ? 'display.discoveryUnavailable' : result.data === null ? 'display.waiting' : 'display.loading')}
    detail={t(result.error ? 'display.retrying' : 'display.startsAutomatically')} />
  return <DisplayProjection key={result.data.id} apiBase={endpoints.api} cableBase={endpoints.cable} config={preferences}
    sessionId={result.data.id} statusOnly={statusOnly} discoveryError={!!result.error} />
}
