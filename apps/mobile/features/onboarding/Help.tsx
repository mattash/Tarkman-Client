import { useRef, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppIcon, type IconName } from '../../components/AppIcon'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { MAX_LANGUAGES } from '../preferences/PreferencesProvider'
import { useOnboarding } from './OnboardingProvider'

export function Help({ card = false, liveAvailable = false }: { card?: boolean; liveAvailable?: boolean }) {
  const { t } = useI18n(), { colors } = useTheme()
  const onboarding = useOnboarding()
  const [visible, setVisible] = useState(false)
  const opener = useRef<React.ComponentRef<typeof View>>(null), launch = useRef<boolean | null>(null)
  const expanded = card && onboarding.ready && onboarding.automatic && !onboarding.record.cardDismissed && onboarding.record.status !== 'completed'
  const start = (restart: boolean) => { launch.current = restart; setVisible(false) }
  return <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
    {expanded && <View style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radii.card, backgroundColor: colors.surface }}>
      <AppText variant="heading">{t('onboarding.cardTitle')}</AppText>
      <AppText>{t('onboarding.cardBody')}</AppText>
      <AppButton ref={opener} variant="secondary" onPress={() => setVisible(true)}>{t('onboarding.basics')}</AppButton>
      <AppButton variant="quiet" onPress={() => onboarding.update({ cardDismissed: true })}>{t('onboarding.dismiss')}</AppButton>
    </View>}
    {!expanded && <AppButton ref={opener} variant="quiet" onPress={() => setVisible(true)}>{t('onboarding.help')}</AppButton>}
    {!card && <AppButton variant="quiet" onPress={() => { onboarding.request(); router.navigate('/') }}>{t('onboarding.tour')}</AppButton>}
    <AppModal visible={visible} onDismiss={() => { launch.current = null; setVisible(false) }} title={t('onboarding.help')} openerRef={opener}
      onAfterDismiss={() => {
        if (launch.current === null) return
        const restart = launch.current; launch.current = null
        onboarding.request(restart)
        router.navigate('/')
      }}>
      <HelpContent />
      <AppText tone="muted">{t(liveAvailable ? 'onboarding.choose' : 'onboarding.unavailable')}</AppText>
      <AppButton onPress={() => start(false)}>{t(onboarding.record.status === 'inProgress' ? 'onboarding.resume' : 'onboarding.show')}</AppButton>
      {onboarding.record.status === 'inProgress' && <AppButton variant="quiet" onPress={() => start(true)}>{t('onboarding.restart')}</AppButton>}
    </AppModal>
  </View>
}
const icons: Record<'open' | 'follow' | 'language' | 'explanation' | 'return' | 'preferences', IconName> = {
  open: 'scan', follow: 'live', language: 'languages', explanation: 'explanation', return: 'live', preferences: 'preferences',
}

const titles = { open: 'onboarding.openTitle', follow: 'onboarding.followTitle', language: 'onboarding.languageTitle', explanation: 'onboarding.explanationTitle', return: 'onboarding.returnTitle', preferences: 'onboarding.preferencesTitle' } as const
const bodies = { open: 'onboarding.openBody', follow: 'onboarding.followBody', language: 'onboarding.languageBody', explanation: 'onboarding.explanationBody', return: 'onboarding.returnBody', preferences: 'onboarding.preferencesBody' } as const

export function HelpContent() {
  const { t } = useI18n(), { colors } = useTheme()
  return <>
      {(['open', 'follow', 'language', 'explanation', 'return', 'preferences'] as const).map(topic => <View key={topic} style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppIcon name={icons[topic]} color={colors.primary} />
          <AppText variant="heading" style={{ flex: 1 }}>{t(titles[topic])}</AppText>
        </View>
        <AppText>{t(topic === 'explanation' ? 'onboarding.explanationFallback' : bodies[topic], { readAlong: t('common.readAlong') })}</AppText>
        {topic === 'language' && <AppText>{t('onboarding.languageNote', { count: MAX_LANGUAGES })}</AppText>}
      </View>)}
  </>
}
