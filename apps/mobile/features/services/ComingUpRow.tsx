import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { capitalized } from '../../components/PartHeading'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import type { LivePart } from '../live/contracts'
import { useI18n } from '../i18n'
import { OpeningLine } from './OpeningLine'

/** Long enough that a scroll or a brush against the rail never moves the projector; short enough to use mid-service. */
export const JUMP_HOLD_MS = 500
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export interface ComingUpRowProps {
  item: LivePart
  language: Language
  selected: readonly Language[]
  /** This row's jump is in flight. */
  sending: boolean
  /** Another command is in flight, or the device is offline. */
  held: boolean
  /** Control was refused for this account: the row is a preview only. */
  readOnly?: boolean
  onJump(): void
}

/**
 * An upcoming part in the control rail. Holding it moves the service there; a tap does nothing, so a stray touch
 * cannot change what the congregation sees. Assistive technology activates it directly.
 */
export function ComingUpRow({ item, language, selected, sending, held, readOnly = false, onJump }: ComingUpRowProps) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [pressed, setPressed] = useState(false)
  const inactive = sending || held || readOnly
  return <Pressable testID={`coming-up-${item.key}`} accessibilityRole={readOnly ? undefined : 'button'}
    accessibilityLabel={readOnly ? undefined : t('control.jumpLabel', { position: item.position, role: capitalized(item.role) })}
    accessibilityHint={readOnly ? undefined : t('control.jumpHint')} accessibilityState={readOnly ? undefined : { disabled: inactive, busy: sending }}
    accessibilityActions={readOnly ? undefined : [{ name: 'activate' }, { name: 'longpress' }]}
    onAccessibilityAction={event => { if (!inactive && (event.nativeEvent.actionName === 'activate' || event.nativeEvent.actionName === 'longpress')) onJump() }}
    disabled={inactive} delayLongPress={JUMP_HOLD_MS} onLongPress={onJump}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginHorizontal: -spacing.xs, borderTopWidth: 1, borderTopColor: colors.divider,
      backgroundColor: pressed ? colors.pressedSubtle : undefined, opacity: held ? 0.56 : 1 }}>
    {/* Posture travels with upcoming parts: an operator wants a second's warning before telling a congregation to move. */}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
      <AppText variant="label" tone="muted" style={{ fontFamily: mono, minWidth: 28 }}>{String(item.position)}</AppText>
      <AppText variant="label" style={{ flex: 1 }}>{capitalized(item.role)}</AppText>
      {item.posture && <AppText variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{item.posture}</AppText>}
      {sending && <ActivityIndicator accessible={false} color={colors.foreground} style={{ alignSelf: 'center' }} />}
    </View>
    {/* A role alone does not tell an operator where the service is going; the opening words do. */}
    <OpeningLine part={item} language={language} selected={selected} numberOfLines={2} />
  </Pressable>
}
