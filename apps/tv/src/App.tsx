import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import foundation from '@tarkman/design/tokens'
import type { Endpoints } from '@tarkman/reader'
import { readerConfig, useReader } from './reader'

const theme = foundation.themes.dark
const config = readerConfig()

// Foundation shell (#213): proves the shared engine runs on tvOS. The live reader is #214.
export function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Text style={styles.title}>Tarkman</Text>
      {config.endpoints ? <Services endpoints={config.endpoints} /> : <Text style={styles.detail}>{config.error}</Text>}
    </View>
  )
}

function Services({ endpoints }: { endpoints: Endpoints }) {
  const state = useReader(endpoints, null)
  if (state.loading) return <Text style={styles.detail}>Loading services…</Text>
  if (state.error) return <Text style={styles.detail}>{state.error}</Text>
  if (state.services.length === 0) return <Text style={styles.detail}>No services right now.</Text>
  return (
    <View>
      {state.services.map(service => (
        <Text key={service.id} style={styles.service}>{service.church} · {service.title}</Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.surfaceCanvas, paddingHorizontal: 96, paddingVertical: 64 },
  title: { color: theme.textPrimary, fontSize: 64, fontWeight: '600', marginBottom: 32 },
  detail: { color: theme.textSecondary, fontSize: 32 },
  service: { color: theme.textPrimary, fontSize: 36, marginBottom: 16 },
})
