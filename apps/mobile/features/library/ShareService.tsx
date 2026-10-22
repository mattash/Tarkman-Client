import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useShareService } from './useShareService'
type Sharing = ReturnType<typeof useShareService>
export function ShareNotice({ sharing }: { sharing: Sharing }) {
  return sharing.notice ? <AppText accessibilityLiveRegion="polite">{sharing.notice}</AppText> : null
}
export function ShareManualModal({ sharing }: { sharing: Sharing }) {
  const { t } = useI18n()
  return <AppModal visible={sharing.manual !== null} onDismiss={sharing.dismiss} openerRef={sharing.anchor} title={t('library.shareManualTitle')}>
    <AppText>{t('library.shareManualHelp')}</AppText><AppText selectable>{sharing.manual}</AppText>
  </AppModal>
}
export function ShareServiceButton({ id, name }: { id: number; name: string }) {
  const sharing = useShareService(), { t } = useI18n()
  return <View style={{ gap: spacing.sm }}>
    <AppButton testID={`library-share-${id}`} ref={sharing.anchor} variant="quiet" icon="share" disabled={sharing.busy}
      accessibilityLabel={t('library.shareTitle', { name })} onPress={() => sharing.share(id, name)}>{t('library.share')}</AppButton>
    <ShareNotice sharing={sharing} /><ShareManualModal sharing={sharing} />
  </View>
}
