import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { StatusPill } from '../../components/StatusPill'
import type { ReaderState } from './state'
import { spacing } from '../../design/tokens'

export function ReaderStatus({ state, retry, compact = false, showLive = true }: { state: ReaderState; retry(): void; compact?: boolean; showLive?: boolean }) {
  const connectionLost = !!state.session && !state.connected && !state.stale
  const live = !!state.session && state.listed && state.connected && !state.stale && !state.error && state.session.status === 'active' && state.following
  return <View style={{ gap: spacing.sm }}>
    {state.loading ? <StatusPill label="Loading service…" tone="info" busy /> : <>
      {showLive && live && <StatusPill label="Live" tone="success" icon="connected" message={compact ? undefined : 'Following the service'} />}
      {state.session && state.session.status !== 'active' && <StatusPill tone="warning" icon="paused"
        label={state.session.status === 'paused' ? 'Service paused' : `Service status: ${state.session.status.replaceAll('_', ' ')}`}
        message={state.session.message ?? (state.session.status === 'paused' ? 'Text stays where it is.' : undefined)} />}
      {state.session && !state.listed && <StatusPill label="Not live" tone="neutral" icon="offline"
        message="This service is no longer listed live. You can continue reading." />}
      {state.error ? <StatusPill label="Connection lost" tone="danger" message={state.error} />
        : state.stale ? <StatusPill label="Reconnecting" tone="info" busy message="Connection interrupted. Reading may be out of date." />
        : connectionLost ? <StatusPill label="Connection lost" tone="danger" message="Live connection unavailable. Checking for updates every 30 seconds." /> : null}
      {state.explanationError && <StatusPill label="Explanations could not be loaded." tone="danger" />}
      {(state.error || state.stale || connectionLost || state.explanationError) && <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" icon="live" loading={state.refreshing} onPress={retry}>Retry connection</AppButton>
      </View>}
    </>}
  </View>
}
