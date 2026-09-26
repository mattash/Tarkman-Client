import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { AppText } from '../../components/AppText'
import { AppButton } from '../../components/AppButton'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useLibrary } from './LibraryProvider'
export function LibraryManagement() {
  const { controller, state } = useLibrary(), { t } = useI18n(), [confirm, setConfirm] = useState(false)
  return <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
    <AppText variant="label" accessibilityRole="header">{t('library.manage')}</AppText>
    <AppButton variant="secondary" onPress={() => router.push('/library')}>{t('library.manage')}</AppButton>
    {controller.durable && (confirm ? <>
      <AppText accessibilityRole="alert">{t('library.clearConfirm')}</AppText>
      <AppButton variant="destructive" onPress={() => { void controller.remove().then(() => setConfirm(false), () => undefined) }}>{t('library.clear')}</AppButton>
      <AppButton variant="quiet" onPress={() => setConfirm(false)}>{t('common.cancel')}</AppButton>
    </> : <AppButton variant="quiet" onPress={() => setConfirm(true)}>{t('library.clear')}</AppButton>)}
    {state.error === 'storage' && <AppText accessibilityRole="alert">{t('library.errors.storage')}</AppText>}
  </View>
}
