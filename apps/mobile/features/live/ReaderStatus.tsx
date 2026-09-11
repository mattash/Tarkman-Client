import { View } from 'react-native'
import { AppText } from '../../components/AppText'
import { AppButton } from '../../components/AppButton'
import type { ReaderState } from './state'
import { spacing } from '../../design/tokens'
export function ReaderStatus({ state, retry }: { state: ReaderState; retry(): void }) {
  const message = state.loading ? 'Loading service…' : state.error ? state.error
    : state.session && !state.listed ? 'This service is no longer listed live. You can continue reading.'
    : state.stale ? 'Connection interrupted. Reading may be out of date.'
    : state.session && !state.connected ? 'Live connection unavailable. Checking for updates every 30 seconds.' : null
  if (!message && !state.explanationError) return null
  return <View style={{ gap: spacing.sm }}>
    {message && <AppText variant="caption" accessibilityRole={state.error ? 'alert' : undefined} accessibilityLiveRegion="polite">{message}</AppText>}
    {state.explanationError && <AppText variant="caption" accessibilityRole="alert">Explanations could not be loaded.</AppText>}
    {(state.error || state.stale || state.explanationError) && !state.loading && <AppButton variant="secondary" loading={state.refreshing} onPress={retry}>Retry connection</AppButton>}
  </View>
}
