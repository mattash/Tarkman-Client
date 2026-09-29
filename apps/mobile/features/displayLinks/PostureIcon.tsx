import { AppText } from '../../components/AppText'
import { useI18n } from '../i18n'
import { statusPostureKey } from './presentation'

/** `width`/`height` are the display area (not necessarily the window); `scale` comes from statusTextScale. */
export interface PostureIconProps { posture: string | null | undefined; width: number; height: number; scale: number }

/** Native fallback; Expo web uses the legacy projector pictograms in PostureIcon.web. */
export function PostureIcon({ posture, width, height, scale }: PostureIconProps) {
  const { t } = useI18n()
  const key = statusPostureKey(posture)
  const label = key ? t(`display.${key}`) : t('display.postureUnavailable')
  const size = Math.max(40, Math.min(width * 0.13, height * 0.18, 160) * scale)
  return <AppText testID="display-posture" accessibilityLabel={label}
    style={{ fontSize: size, lineHeight: size * 1.25, textAlign: 'center' }}>{label}</AppText>
}
