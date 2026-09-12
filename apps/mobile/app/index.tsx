import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AppText } from '../components/AppText'
import { AppButton } from '../components/AppButton'
import { spacing } from '../design/tokens'
import { useAuth } from '../features/auth/AuthProvider'
import { readerConfig } from '../features/live/config'
import { Discovery } from '../features/live/Discovery'
export default function LiveScreen() {
  const { state } = useAuth()
  const config = readerConfig()
  if (!config.endpoints) return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
    <AppText variant="title">Follow the service.</AppText>
    <AppText accessibilityRole="alert">{config.error}</AppText>
    <AppButton variant="secondary" onPress={() => router.push('/gallery')}>Explore the design gallery</AppButton>
  </ScrollView>
  return <View style={{ flex: 1 }}>
    <Discovery endpoints={config.endpoints} open={id => router.push(`/sessions/${id}/parts`)} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
      {state.status === 'signedIn' && <AppButton variant="quiet" onPress={() => router.push('/services')}>My services</AppButton>}
      {state.status === 'signedOut' && <AppButton variant="quiet" onPress={() => router.push('/sign-in')}>Sign in</AppButton>}
      <AppButton variant="quiet" onPress={() => router.push('/gallery')}>Design gallery</AppButton>
    </View>
  </View>
}
