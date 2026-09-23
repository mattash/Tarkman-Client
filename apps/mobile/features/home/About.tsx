import { ScrollView, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ServiceRow } from '../../components/ServiceRow'
import { Card } from '../../components/Surface'
import { spacing } from '../../design/tokens'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'

/**
 * What Tarkman is and who makes it, then the operator account. Reading along never
 * needs an account, so sign-in lives here rather than on the reading screens.
 */
export function About() {
  const { state, signOut } = useAuth()
  const { fontScale } = useWindowDimensions()
  const { t } = useI18n()
  const page = fontScale > 2 ? spacing.md : spacing.page
  return <ScrollView testID="about" contentContainerStyle={{ paddingTop: 6, paddingHorizontal: page, paddingBottom: spacing.xl }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <ScreenHeader title={t('tabs.about')} />
      <Card>
        <AppText variant="heading">{t('about.creditsTitle')}</AppText>
        <AppText tone="muted">{t('about.credits')}</AppText>
      </Card>
      {state.status !== 'hydrating' && <View style={{ gap: spacing.md }}>
        <AppText variant="label" tone="muted" accessibilityRole="header">{t('settings.account')}</AppText>
        {state.status === 'signedIn' ? <>
          <AppText variant="caption" tone="muted">{t('common.signedInAs', { name: state.user.name || state.user.email })}</AppText>
          <ServiceRow title={t('common.myServices')} subtitle={t('settings.myServicesSubtitle')} onPress={() => router.push('/services')} />
          <ServiceRow title={t('links.title')} subtitle={t('links.accountSubtitle')} onPress={() => router.push('/display-links')} />
          <View style={{ alignSelf: 'flex-start' }}><AppButton variant="secondary" size="card" onPress={signOut}>{t('common.signOut')}</AppButton></View>
        </> : <ServiceRow testID="about-sign-in" title={t('common.signIn')} subtitle={t('settings.signInSubtitle')} onPress={() => router.push('/sign-in')} />}
      </View>}
    </View>
  </ScrollView>
}
