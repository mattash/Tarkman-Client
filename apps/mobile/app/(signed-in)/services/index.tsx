import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { spacing } from '../../../design/tokens'
import { isUnauthorized, useAuth } from '../../../features/auth/AuthProvider'
import { fetchMyServices, formatServiceDate, statusLabel, type MyService } from '../../../features/services/api'

interface ServicesResult { services: MyService[]; loading: boolean; error?: string }

export default function MyServicesScreen() {
  const { state, authorizedFetch, signOut } = useAuth()
  const [result, setResult] = useState<ServicesResult>({ services: [], loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetchMyServices(authorizedFetch, controller.signal).then(services => {
      if (!controller.signal.aborted) setResult({ services, loading: false })
    }, failure => {
      // An ended sign-in is handled by the signed-in layout, which returns to the sign-in screen.
      if (controller.signal.aborted || isUnauthorized(failure)) return
      setResult({ services: [], loading: false, error: failure instanceof Error ? failure.message : 'Could not load your services. Please retry.' })
    })
    return () => controller.abort()
  }, [authorizedFetch, attempt])
  const retry = () => { setResult(current => ({ ...current, loading: true, error: undefined })); setAttempt(count => count + 1) }
  const user = state.status === 'signedIn' ? state.user : null

  return <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/') } }}>Live services</AppButton>
      </View>
      <AppText variant="label" tone="accent">TARKMAN / MY SERVICES</AppText>
      <AppText variant="title">Your services</AppText>
      {user && <AppText tone="muted">Signed in as {user.name || user.email}</AppText>}
      {result.loading && <ActivityIndicator accessibilityLabel="Loading your services" />}
      {result.error && <Card><AppText accessibilityRole="alert">{result.error}</AppText><AppButton variant="secondary" onPress={retry}>Retry</AppButton></Card>}
      {!result.loading && !result.error && result.services.length === 0 && <Card><AppText variant="heading">No services yet</AppText>
        <AppText tone="muted">Services you create on the Tarkman website appear here.</AppText></Card>}
      {result.services.map(service => <Card key={service.id}>
        <AppText variant="heading">{service.title}</AppText>
        <AppText tone="muted">{[service.church, formatServiceDate(service.date)].filter(Boolean).join(' · ')}</AppText>
        <AppText variant="caption">{statusLabel(service.status)}</AppText>
        <AppButton accessibilityLabel={`Open controls for ${service.title}`} onPress={() => router.push(`/services/${service.id}`)}>Open controls</AppButton>
      </Card>)}
      <AppButton variant="secondary" onPress={signOut}>Sign out</AppButton>
    </View>
  </ScrollView>
}
