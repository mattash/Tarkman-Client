import { ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppText } from '../../components/AppText'
import { spacing } from '../../design/tokens'
import { readerConfig } from '../../features/live/config'
import { DisplayLinkScreen } from '../../features/displayLinks/DisplayLinkScreen'

/**
 * Current-session display route at `/sessions/display?token=...`, mirroring the
 * web's canonical shape. The full "always follow live" resolver lands in PR4;
 * this PR renders the configuration placeholder so the route exists.
 */
export default function DisplayCurrentRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const config = readerConfig()
  if (!config.endpoints) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
      <AppText variant="title">{config.error}</AppText>
    </ScrollView>
  }
  return <DisplayLinkScreen apiBase={config.endpoints.api} token={token ?? ''} />
}
