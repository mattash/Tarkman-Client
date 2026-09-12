import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { spacing } from '../../../design/tokens'
import { readerConfig } from '../../../features/live/config'
import { SessionReader } from '../../../features/live/SessionReader'

export default function SessionReaderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const sessionId = Number(id)
  const config = readerConfig()
  const leave = () => { if (router.canGoBack()) { router.back() } else { router.replace('/') } }
  if (!config.endpoints || !Number.isInteger(sessionId) || sessionId <= 0) {
    return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{config.endpoints ? 'That service link is not valid.' : config.error}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/')}>All services</AppButton>
    </ScrollView>
  }
  return <View style={{ flex: 1 }}>
    <SessionReader key={sessionId} endpoints={config.endpoints} id={sessionId} back={leave} />
  </View>
}
