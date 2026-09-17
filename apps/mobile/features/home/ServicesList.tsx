import { useState } from 'react'
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader'
import { ServiceRow } from '../../components/ServiceRow'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { ReaderStatus } from '../live/ReaderStatus'
import { useServices } from './ServicesProvider'
import { useI18n } from '../i18n'

/** Every public service listed for today, whatever the reader's location. */
export function ServicesList() {
  const { state, retry } = useServices()
  const { colors } = useTheme()
  const { fontScale } = useWindowDimensions()
  const { t } = useI18n()
  const [pulling, setPulling] = useState(false)
  const page = fontScale > 2 ? spacing.md : spacing.page
  return <ScrollView testID="services-list" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.lg }}
    refreshControl={<RefreshControl refreshing={pulling && state.refreshing} tintColor={colors.muted} onRefresh={() => { setPulling(true); retry() }} />}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <ScreenHeader title={t('servicesList.title')}>
        <HeaderIconButton icon="scan" label={t('common.scanACode')} onPress={() => router.push('/scan')} />
      </ScreenHeader>
      <AppText tone="muted" style={{ marginTop: 18 }}>{t('servicesList.intro')}</AppText>
      {(state.loading || state.error) && <View style={{ marginTop: 18 }}><ReaderStatus state={state} retry={retry} /></View>}
      {!state.loading && !state.error && state.services.length === 0 && <AppText tone="muted" style={{ marginTop: 18 }}>{t('today.nothingLive')}</AppText>}
      {state.services.length > 0 && <View style={{ marginTop: 26, gap: 10 }}>
        {state.services.map(session => <ServiceRow key={session.id} live={session.status === 'active'} title={session.title} subtitle={session.church}
          accessibilityLabel={t(session.status === 'active' ? 'servicesList.rowLiveLabel' : 'servicesList.rowLabel', { title: session.title, church: session.church })}
          onPress={() => router.push(`/sessions/${session.id}/parts`)} />)}
      </View>}
      <View style={{ marginTop: 26, alignSelf: 'flex-start' }}>
        <AppButton variant="secondary" size="card" loading={state.refreshing} onPress={retry}>{t('servicesList.refresh')}</AppButton>
      </View>
    </View>
  </ScrollView>
}
