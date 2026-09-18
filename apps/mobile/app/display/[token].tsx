import { ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppText } from '../../components/AppText'
import { spacing } from '../../design/tokens'
import { readerConfig } from '../../features/live/config'
import { DisplayLinkScreen } from '../../features/displayLinks/DisplayLinkScreen'

export default function DisplayRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const config = readerConfig()
  if (!config.endpoints) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
      <AppText variant="title">{config.error}</AppText>
    </ScrollView>
  }
  return <DisplayLinkScreen apiBase={config.endpoints.api} token={token ?? ''} />
}
