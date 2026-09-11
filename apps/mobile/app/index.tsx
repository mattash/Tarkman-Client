import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AppText } from '../components/AppText'
import { AppButton } from '../components/AppButton'
import { spacing } from '../design/tokens'
import { readerConfig } from '../features/live/config'
import { Discovery } from '../features/live/Discovery'
import { SessionReader } from '../features/live/SessionReader'
export default function LiveScreen() {
  const [id, setId] = useState<number | null>(null)
  const config = readerConfig()
  if (!config.endpoints) return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
    <AppText variant="title">Follow the service.</AppText>
    <AppText accessibilityRole="alert">{config.error}</AppText>
    <AppButton variant="secondary" onPress={() => router.push('/gallery')}>Explore the design gallery</AppButton>
  </ScrollView>
  return <View style={{ flex: 1 }}>
    {id === null ? <Discovery endpoints={config.endpoints} open={setId} /> : <SessionReader key={id} endpoints={config.endpoints} id={id} back={() => setId(null)} />}
    {id === null && <AppButton variant="quiet" onPress={() => router.push('/gallery')}>Design gallery</AppButton>}
  </View>
}
