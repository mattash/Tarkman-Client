import { ActivityIndicator, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { BackButton } from '../../components/BackButton'
import { AppText } from '../../components/AppText'
import { Card } from '../../components/Surface'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { LinkActions } from './LinkActions'
import type { ManagerController, ManagerSnapshot } from './ManagerRoute'

export function LinkList({ state, controller }: { state: ManagerSnapshot; controller: ManagerController }) {
  const { t } = useI18n()
  return <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}><BackButton onPress={() => router.replace('/about')}>{t('tabs.about')}</BackButton></View>
      <AppText variant="title" accessibilityRole="header">{t('links.title')}</AppText>
      <AppText tone="muted">{t('links.intro')}</AppText>
      <AppButton size="tier" onPress={() => router.push('/display-links/new')}>{t('links.create')}</AppButton>
      <View style={{ alignItems: 'center' }}><AppButton variant="text" icon="refresh" loading={state.loading} onPress={controller.refresh}>{t('links.refresh')}</AppButton></View>
      {state.loading && <ActivityIndicator accessibilityLabel={t('links.loading')} />}
      {state.error && <Card><AppText accessibilityRole="alert">{state.error}</AppText><AppButton onPress={controller.refresh}>{t('common.retry')}</AppButton></Card>}
      {state.loaded && !state.error && !state.links.length && <Card><AppText variant="heading">{t('links.empty')}</AppText><AppText>{t('links.intro')}</AppText></Card>}
      {state.links.map(link => <Card key={link.token}>
        <AppText variant="heading">{link.title}</AppText>
        <AppText tone="muted">{t('links.summary', { mode: t(`links.${link.mode}`), device: t(`links.${link.device_type}`), scale: link.font_scale,
          languages: [link.lang1, ...(link.mode === 'parallel' && link.lang2 ? [link.lang2] : [])].map(language => t(`links.${language}`)).join(' / ') })}</AppText>
        {typeof link.published === 'boolean' && <AppText tone="muted">{t(link.published ? 'links.listingOn' : 'links.listingOff')}</AppText>}
        <AppButton variant="secondary" size="tier" accessibilityLabel={t('links.editTitle', { title: link.title })} onPress={() => router.push({ pathname: '/display-links/[token]', params: { token: link.token } })}>{t('links.edit')}</AppButton>
        <LinkActions link={link} />
      </Card>)}
      <AppText variant="caption" tone="muted">{t('links.privacy')}</AppText>
    </View>
  </ScrollView>
}
