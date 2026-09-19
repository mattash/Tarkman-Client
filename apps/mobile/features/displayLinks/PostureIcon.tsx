import { useWindowDimensions } from 'react-native'
import { AppText } from '../../components/AppText'
import { useI18n } from '../i18n'
import { displayPosture } from './presentation'

export interface PostureIconProps { posture: string | null | undefined }

/** Native fallback; Expo web uses the legacy projector pictograms in PostureIcon.web. */
export function PostureIcon({ posture }: PostureIconProps) {
  const { width, height } = useWindowDimensions()
  const { t } = useI18n()
  const label = displayPosture(posture) ?? t('display.postureUnavailable')
  const size = Math.max(40, Math.min(width * 0.13, height * 0.18, 160))
  return <AppText testID="display-posture" accessibilityLabel={label}
    style={{ fontSize: size, lineHeight: size * 1.25, textAlign: 'center' }}>{label}</AppText>
}
