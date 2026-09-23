import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { capitalized } from '../../components/PartHeading'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import type { LivePart } from '../live/contracts'
import { useI18n } from '../i18n'
import { ControlButton } from './ControlButton'
import { OpeningLine } from './OpeningLine'

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export interface ComingUpRowProps {
  item: LivePart
  language: Language
  selected: readonly Language[]
  /** Go here is showing under this row. */
  armed: boolean
  /** This row's jump is in flight. */
  sending: boolean
  /** Another command is in flight, or the device is offline. */
  held: boolean
  /** Control was refused for this account: the row is a preview only. */
  readOnly?: boolean
  /** Shows or hides Go here. */
  onArm(): void
  onJump(): void
}

/**
 * An upcoming part in the control rail. A tap only shows Go here under it; the service moves on that second tap,
 * so a stray touch cannot change what the congregation sees.
 */
export function ComingUpRow({ item, language, selected, armed, sending, held, readOnly = false, onArm, onJump }: ComingUpRowProps) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const [pressed, setPressed] = useState(false)
  const role = capitalized(item.role)
  return <View testID={`coming-up-${item.key}`} style={{ gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginHorizontal: -spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: armed || pressed ? colors.pressedSubtle : undefined }}>
    <Pressable accessibilityRole={readOnly ? undefined : 'button'} disabled={readOnly}
      accessibilityLabel={t('serviceSheet.partRow', { position: item.position, role })}
      accessibilityHint={readOnly ? undefined : t('control.armHint')} accessibilityState={readOnly ? undefined : { expanded: armed }}
      onPress={onArm} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ gap: 2 }}>
      {/* Posture travels with upcoming parts: an operator wants a second's warning before telling a congregation to move. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
        <AppText variant="label" tone="muted" style={{ fontFamily: mono, minWidth: 28 }}>{String(item.position)}</AppText>
        <AppText variant="label" style={{ flex: 1 }}>{role}</AppText>
        {item.posture && <AppText variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{item.posture}</AppText>}
      </View>
      {/* A role alone does not tell an operator where the service is going; the opening words do. */}
      <OpeningLine part={item} language={language} selected={selected} numberOfLines={2} />
    </Pressable>
    {armed && !readOnly && <ControlButton variant="primary" label={t('serviceSheet.goHere')} accessibilityLabel={t('serviceSheet.goToPartLabel', { position: item.position })}
      accessibilityHint={t('control.nextHint', { role })} height={48} labelVariant="label" sending={sending} held={held} onPress={onJump} />}
  </View>
}
