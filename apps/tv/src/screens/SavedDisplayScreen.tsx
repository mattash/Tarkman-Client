import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { DisplayLinkConfig, Endpoints } from '@tarkman/reader'
import { FocusButton } from '../components/FocusButton'
import { Notice } from '../components/Notice'
import { ResetControl } from '../components/ResetControl'
import { useCurrentSession, useLinkConfig } from '../displayLinks'
import { useMenuBack } from '../hooks'
import { useI18n } from '../i18n'
import type { ReaderTransport } from '../reader'
import type { SavedDisplayV1 } from '../savedDisplay'
import { safe, space } from '../theme'
import { DisplayScreen } from './DisplayScreen'

const UNAVAILABLE_RECHECK_MS = 5 * 60_000

interface Props {
  endpoints: Endpoints
  saved: SavedDisplayV1
  transport?: ReaderTransport
  request?: typeof fetch
  /** Back from the running display: opens the management screen. */
  onManage(): void
  onChangeDisplay(): void
  onBrowseServices(): void
  onSettings(): void
  onReset(): Promise<void>
}

/**
 * The launch screen once a church display is saved: resolves the display's current public
 * configuration (revisioned, live-updated), finds the church's current service, and follows it,
 * whichever service is live. The saved choice is never changed by transport failures; only an explicit
 * replace or reset does that.
 */
export function SavedDisplayScreen(props: Props) {
  const { t } = useI18n()
  const { endpoints, saved, transport, request } = props
  const [attempt, setAttempt] = useState(0)
  const link = useLinkConfig(endpoints, saved.link.token, transport, request, attempt)
  // In every state Menu opens the management screen, so Back behaves the same wherever the TV is.
  useMenuBack(true, props.onManage)
  // A removed or expired link is authoritative, but an unattended TV still looks again from time to
  // time (a mis-deploy or a proxy answering 403/404 should not freeze it until someone visits).
  const terminal = link.terminal
  useEffect(() => {
    if (!terminal) return
    const timer = setTimeout(() => setAttempt(value => value + 1), UNAVAILABLE_RECHECK_MS)
    return () => clearTimeout(timer)
  }, [terminal, attempt])

  if (link.terminal) {
    const expired = link.terminal === 'expired'
    return (
      <Frame actions={<>
        <FocusButton testID="unavailable-retry" label={t('savedDisplay.retry')} variant="primary" hasTVPreferredFocus onPress={() => setAttempt(value => value + 1)} />
        <FocusButton testID="unavailable-change" label={t('savedDisplay.change')} onPress={props.onChangeDisplay} />
        <ResetControl testID="unavailable-reset" onReset={props.onReset} />
      </>}>
        <Notice testID="display-link-unavailable" icon="warning" title={t('savedDisplay.unavailableTitle')}
          detail={t(expired ? 'savedDisplay.unavailableExpired' : 'savedDisplay.unavailableGone', { title: saved.link.title })} />
      </Frame>
    )
  }
  if (!link.data) {
    return (
      <Frame actions={<ChangeActions {...props} />}>
        <Notice testID={link.error ? 'display-link-failed' : 'display-link-loading'} busy={!link.error} icon={link.error ? 'warning' : undefined}
          title={t(link.error ? 'savedDisplay.couldNotLoad' : 'savedDisplay.loading')} detail={link.error ? t('savedDisplay.retrying') : undefined} />
      </Frame>
    )
  }
  return <CurrentDisplay key={`${saved.link.token}/${link.data.user_id}`} {...props} config={link.data} />
}

function CurrentDisplay({ config, ...props }: Props & { config: DisplayLinkConfig }) {
  const { t } = useI18n()
  const { endpoints, transport, request } = props
  const current = useCurrentSession(endpoints, config.user_id, request)
  const session = current.data
  if (session) {
    return <DisplayScreen key={session.id} endpoints={endpoints} transport={transport} id={session.id} config={config} bare onBack={props.onManage} />
  }
  return (
    <Frame actions={<ChangeActions {...props} />}>
      {session === null
        ? <Notice testID="display-link-waiting" icon="waiting" title={t('savedDisplay.waiting')} detail={t('savedDisplay.waitingDetail')} />
        : <Notice testID={current.error ? 'display-link-discovery-failed' : 'display-link-discovering'} busy={!current.error} icon={current.error ? 'warning' : undefined}
          title={t(current.error ? 'savedDisplay.discoveryFailed' : 'savedDisplay.loading')} detail={current.error ? t('savedDisplay.retrying') : undefined} />}
    </Frame>
  )
}

/** The change entries every waiting and error screen carries, so a stuck TV can always be re-pointed. */
function ChangeActions({ onChangeDisplay, onBrowseServices, onSettings }: Props) {
  const { t } = useI18n()
  return (
    <>
      <FocusButton testID="waiting-change" label={t('savedDisplay.change')} hasTVPreferredFocus onPress={onChangeDisplay} />
      <FocusButton testID="waiting-services" label={t('savedDisplay.services')} onPress={onBrowseServices} />
      <FocusButton testID="waiting-settings" label={t('savedDisplay.settings')} onPress={onSettings} />
    </>
  )
}

function Frame({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <View style={styles.frame}>
      {children}
      <View style={styles.actions}>{actions}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1, },
  actions: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: safe.horizontal, paddingBottom: safe.vertical },
})
