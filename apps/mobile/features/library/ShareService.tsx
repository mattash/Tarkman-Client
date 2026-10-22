import type { RefObject } from 'react'
import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useShareService } from './useShareService'
export function ShareNotice({ notice }: { notice: string }) {
  return notice ? <AppText accessibilityLiveRegion="polite">{notice}</AppText> : null
}
export function ShareManualModal({ manual, dismiss, openerRef }: { manual: string | null; dismiss: () => void; openerRef: RefObject<View | null> }) {
  const { t } = useI18n()
  return <AppModal visible={manual !== null} onDismiss={dismiss} openerRef={openerRef} title={t('library.shareManualTitle')}>
    <AppText>{t('library.shareManualHelp')}</AppText><AppText selectable>{manual}</AppText>
  </AppModal>
}
export function ShareServiceButton({ id, name }: { id: number; name: string }) {
  const { anchor, busy, notice, manual, dismiss, share } = useShareService(), { t } = useI18n()
  return <View style={{ gap: spacing.sm }}>
    <AppButton testID={`library-share-${id}`} ref={anchor} variant="quiet" icon="share" disabled={busy}
      accessibilityLabel={t('library.shareTitle', { name })} onPress={() => share(id, name)}>{t('library.share')}</AppButton>
    <ShareNotice notice={notice} /><ShareManualModal manual={manual} dismiss={dismiss} openerRef={anchor} />
  </View>
}
