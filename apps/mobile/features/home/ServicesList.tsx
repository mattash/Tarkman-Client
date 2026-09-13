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

/** Every public service listed for today, whatever the reader's location. */
export function ServicesList() {
  const { state, retry } = useServices()
  const { colors } = useTheme()
  const { fontScale } = useWindowDimensions()
  const [pulling, setPulling] = useState(false)
  const page = fontScale > 2 ? spacing.md : spacing.page
  return <ScrollView testID="services-list" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.lg }}
    refreshControl={<RefreshControl refreshing={pulling && state.refreshing} tintColor={colors.muted} onRefresh={() => { setPulling(true); retry() }} />}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <ScreenHeader title="Services">
        <HeaderIconButton icon="scan" label="Scan a code" onPress={() => router.push('/scan')} />
      </ScreenHeader>
      <AppText tone="muted" style={{ marginTop: 18 }}>Public services taking place today. Open one to read along in your language.</AppText>
      {(state.loading || state.error) && <View style={{ marginTop: 18 }}><ReaderStatus state={state} retry={retry} /></View>}
      {!state.loading && !state.error && state.services.length === 0 && <AppText tone="muted" style={{ marginTop: 18 }}>No service is live right now.</AppText>}
      {state.services.length > 0 && <View style={{ marginTop: 26, gap: 10 }}>
        {state.services.map(session => <ServiceRow key={session.id} live={session.status === 'active'} title={session.title} subtitle={session.church}
          accessibilityLabel={`${session.title}, ${session.church}${session.status === 'active' ? ', live now' : ''}`}
          onPress={() => router.push(`/sessions/${session.id}/parts`)} />)}
      </View>}
      <View style={{ marginTop: 26, alignSelf: 'flex-start' }}>
        <AppButton variant="secondary" size="card" loading={state.refreshing} onPress={retry}>Refresh services</AppButton>
      </View>
    </View>
  </ScrollView>
}
