import { FlashList } from '@shopify/flash-list'
import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../../components/AppButton'
import { BackButton } from '../../../components/BackButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { spacing } from '../../../design/tokens'
import { useAuth } from '../../../features/auth/AuthProvider'
import { recordRecentlyControlled } from '../../../features/progress/recentlyControlled'
import { formatServiceDate, statusLabel } from '../../../features/services/api'
import { useMyServices } from '../../../features/services/useMyServices'
import { useI18n } from '../../../features/i18n'
import { readerConfig } from '../../../features/live/config'
import { claimReconcile, dismissMutation, managementScope, useMutationNotice } from '../../../features/services/management/mutations'

export default function MyServicesScreen() {
  const { state, authorizedFetch, signOut } = useAuth()
  const result = useMyServices(authorizedFetch)
  const user = state.status === 'signedIn' ? state.user : null
  const { t } = useI18n()
  const allLoaded = t('myServices.allLoaded')
  const notice = useMutationNotice(user ? managementScope(readerConfig().endpoints?.api, user.id) : null)
  // Each confirmed write reconciles the owned list once, from page one; a later mount just loads normally.
  const { reconcile } = result
  useEffect(() => {
    if (notice && claimReconcile(notice)) void reconcile()
  }, [notice, reconcile])
  const openControls = (service: { id: number; title: string; church?: string; date: string | null }) => {
    if (user) void recordRecentlyControlled({ sessionId: service.id, title: service.title, church: service.church ?? '', date: service.date }, user.id)
    router.push(`/services/${service.id}`)
  }
  useEffect(() => {
    if (result.paginationComplete && Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(allLoaded)
    }
  }, [result.paginationComplete, allLoaded])

  return <FlashList testID="my-services-list" data={result.services} keyExtractor={service => String(service.id)}
    contentContainerStyle={{ padding: spacing.lg }}
    refreshing={result.refreshing} onRefresh={result.refresh}
    onEndReached={result.loadMore} onEndReachedThreshold={0.3}
    maintainVisibleContentPosition={{ disabled: true }}
    ListHeaderComponent={
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <BackButton onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/settings') } }}>{t('common.settings')}</BackButton>
      </View>
      <AppText variant="title">{t('myServices.title')}</AppText>
      {user && <AppText tone="muted">{t('common.signedInAs', { name: user.name || user.email })}</AppText>}
      {/* Always above the cards, whatever state the list is in: creation has its own availability check. */}
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton testID="add-session" size="tier" icon="add" accessibilityHint={t('sessionManagement.addSessionHint')}
          onPress={() => router.push('/session-management/new')}>{t('sessionManagement.addSession')}</AppButton>
      </View>
      {notice && <Card testID="mutation-notice">
        <AppText variant="heading" accessibilityRole="alert">{t(notice.kind === 'created' ? notice.replayed ? 'sessionManagement.replayed' : 'sessionManagement.created' : notice.kind === 'saved' ? 'sessionManagement.saved' : 'sessionManagement.deleted')}</AppText>
        <AppText tone="muted">{t('sessionManagement.summary', { title: notice.session.title, date: formatServiceDate(notice.session.date) ?? '' })}</AppText>
        {result.error && !result.refreshing && <AppText>{t('sessionManagement.refreshFailed')}</AppText>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {notice.kind !== 'deleted' && <AppButton size="tier" accessibilityLabel={t('myServices.openControlsLabel', { title: notice.session.title })}
            onPress={() => openControls(notice.session)}>{t('myServices.openControls')}</AppButton>}
          <AppButton variant="text" accessibilityLabel={t('sessionManagement.dismissLabel')} onPress={() => dismissMutation(notice)}>{t('sessionManagement.dismiss')}</AppButton>
        </View>
      </Card>}
      {(result.loading || (result.refreshing && result.services.length === 0)) && <ActivityIndicator accessibilityLabel={t('myServices.loading')} />}
      {result.error && <Card><AppText accessibilityRole="alert">{result.error}</AppText><AppButton variant="secondary" onPress={result.retry}>{t('common.retry')}</AppButton></Card>}
      {!result.loading && !result.refreshing && !result.error && result.services.length === 0 && <Card><AppText variant="heading">{t('myServices.noneTitle')}</AppText>
        <AppText tone="muted">{t('myServices.noneNote')}</AppText></Card>}
    </View>}
    renderItem={({ item: service }) => <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', marginTop: spacing.lg }}><Card>
        <AppText variant="heading">{service.title}</AppText>
        <AppText tone="muted">{[service.church, formatServiceDate(service.date)].filter(Boolean).join(' · ')}</AppText>
        <AppText variant="caption">{statusLabel(service.status)}</AppText>
        <AppButton size="tier" accessibilityLabel={t('myServices.openControlsLabel', { title: service.title })} onPress={() => openControls(service)}>{t('myServices.openControls')}</AppButton>
      </Card></View>}
    ListFooterComponent={<View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
      {result.loadingMore && <ActivityIndicator accessibilityLabel={t('myServices.loadingMore')} />}
      {result.loadMoreError && <Card><AppText accessibilityRole="alert">{result.loadMoreError}</AppText>
        <AppButton variant="secondary" accessibilityLabel={t('myServices.retryMoreLabel')} onPress={result.retryLoadMore}>{t('common.retry')}</AppButton></Card>}
      {!result.loading && !result.refreshing && !result.error && !result.loadingMore && !result.loadMoreError && result.services.length > 0 && (
        result.nextCursor
          ? <AppButton variant="quiet" onPress={result.loadMore}>{t('myServices.loadMore')}</AppButton>
          : <AppText accessibilityLiveRegion="polite" tone="muted">{allLoaded}</AppText>
      )}
      <AppButton variant="secondary" onPress={signOut}>{t('common.signOut')}</AppButton>
    </View>}
  />
}
