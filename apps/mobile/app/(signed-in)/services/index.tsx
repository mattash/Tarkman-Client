import { FlashList } from '@shopify/flash-list'
import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { spacing } from '../../../design/tokens'
import { useAuth } from '../../../features/auth/AuthProvider'
import { formatServiceDate, statusLabel } from '../../../features/services/api'
import { useMyServices } from '../../../features/services/useMyServices'

export default function MyServicesScreen() {
  const { state, authorizedFetch, signOut } = useAuth()
  const result = useMyServices(authorizedFetch)
  const user = state.status === 'signedIn' ? state.user : null
  useEffect(() => {
    if (result.paginationComplete && Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility('All services loaded')
    }
  }, [result.paginationComplete])

  return <FlashList testID="my-services-list" data={result.services} keyExtractor={service => String(service.id)}
    contentContainerStyle={{ padding: spacing.lg }}
    refreshing={result.refreshing} onRefresh={result.refresh}
    onEndReached={result.loadMore} onEndReachedThreshold={0.3}
    maintainVisibleContentPosition={{ disabled: true }}
    ListHeaderComponent={
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" icon="back" onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/settings') } }}>Settings</AppButton>
      </View>
      <AppText variant="label" tone="accent">TARKMAN / MY SERVICES</AppText>
      <AppText variant="title">Your services</AppText>
      {user && <AppText tone="muted">Signed in as {user.name || user.email}</AppText>}
      {result.loading && <ActivityIndicator accessibilityLabel="Loading your services" />}
      {result.error && <Card><AppText accessibilityRole="alert">{result.error}</AppText><AppButton variant="secondary" onPress={result.retry}>Retry</AppButton></Card>}
      {!result.loading && !result.error && result.services.length === 0 && <Card><AppText variant="heading">No services yet</AppText>
        <AppText tone="muted">Services you create on the Tarkman website appear here.</AppText></Card>}
    </View>}
    renderItem={({ item: service }) => <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', marginTop: spacing.lg }}><Card>
        <AppText variant="heading">{service.title}</AppText>
        <AppText tone="muted">{[service.church, formatServiceDate(service.date)].filter(Boolean).join(' · ')}</AppText>
        <AppText variant="caption">{statusLabel(service.status)}</AppText>
        <AppButton accessibilityLabel={`Open controls for ${service.title}`} onPress={() => router.push(`/services/${service.id}`)}>Open controls</AppButton>
      </Card></View>}
    ListFooterComponent={<View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
      {result.loadingMore && <ActivityIndicator accessibilityLabel="Loading more services" />}
      {result.loadMoreError && <Card><AppText accessibilityRole="alert">{result.loadMoreError}</AppText>
        <AppButton variant="secondary" accessibilityLabel="Retry loading more services" onPress={result.retryLoadMore}>Retry</AppButton></Card>}
      {!result.loading && !result.error && !result.loadingMore && !result.loadMoreError && result.services.length > 0 && (
        result.nextCursor
          ? <AppButton variant="quiet" onPress={result.loadMore}>Load more services</AppButton>
          : <AppText accessibilityLiveRegion="polite" tone="muted">All services loaded</AppText>
      )}
      <AppButton variant="secondary" onPress={signOut}>Sign out</AppButton>
    </View>}
  />
}
