import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { StatusPill } from '../../components/StatusPill'
import type { ReaderState } from './state'
import { spacing } from '../../design/tokens'
import { activeInterfaceLanguage, statusName, useI18n } from '../i18n'

export function ReaderStatus({ state, retry, compact = false, showLive = true, showService = true, savedCopy = false }: {
  state: ReaderState; retry(): void; compact?: boolean; showLive?: boolean
  /** False where the screen already shows the service's status itself, as service control does in its header. */
  showService?: boolean; savedCopy?: boolean
}) {
  const { t } = useI18n()
  const connectionLost = !!state.session && !state.connected && !state.stale
  const live = !!state.session && state.listed && state.connected && !state.stale && !state.error && state.session.status === 'active' && state.following
  return <View style={{ gap: spacing.sm }}>
    {savedCopy && <StatusPill tone="neutral" icon="offline" label={t('readerStatus.savedCopy')}
      message={t('readerStatus.savedCopyMessage')} />}
    {state.loading ? <StatusPill label={t('readerStatus.loadingService')} tone="info" busy /> : <>
      {!savedCopy && showLive && live && <StatusPill label={t('common.live')} tone="success" icon="connected" announce={false} message={compact ? undefined : t('readerStatus.followingService')} />}
      {showService && state.session && state.session.status !== 'active' && <StatusPill tone="warning" icon="paused"
        label={state.session.status === 'paused' ? t('readerStatus.servicePaused') : t('readerStatus.serviceStatus', { status: statusStatusText(state.session.status) })}
        message={state.session.message ?? (state.session.status === 'paused' ? t('readerStatus.textStays') : undefined)} />}
      {state.session && !state.listed && <StatusPill label={t('readerStatus.notLive')} tone="neutral" icon="offline"
        message={t('readerStatus.noLongerListed')} />}
      {state.error ? <StatusPill label={t('common.connectionLost')} tone="danger" message={state.error} />
        : state.stale ? <StatusPill label={t('common.reconnecting')} tone="info" busy message={t('readerStatus.connectionInterrupted')} />
        : connectionLost ? <StatusPill label={t('common.connectionLost')} tone="danger" message={t('readerStatus.liveUnavailable')} /> : null}
      {state.explanationError && <StatusPill label={t('readerStatus.explanationsNotLoaded')} tone="danger" />}
      {(state.error || state.stale || connectionLost || state.explanationError) && <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" icon="live" loading={state.refreshing} onPress={retry}>{t('readerStatus.retryConnection')}</AppButton>
      </View>}
    </>}
  </View>
}

/** English keeps the raw status as sent ("showing gospel"); another interface language names known statuses. */
function statusStatusText(status: string): string {
  return activeInterfaceLanguage() === 'en' ? status.replaceAll('_', ' ') : statusName(status)
}
