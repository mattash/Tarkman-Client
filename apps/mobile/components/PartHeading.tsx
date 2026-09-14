import { useWindowDimensions, View } from 'react-native'
import { spacing } from '../design/tokens'
import { AppText } from './AppText'

/**
 * A part's role with its posture as an eyebrow above it. Posture is an instruction the congregation acts on,
 * so it is never collapsed and never placed below the text. The tree keeps role first so a screen reader
 * says "Priest, heading. Stand." while the eyebrow still draws above.
 */
export function PartHeading({ role, posture }: { role: string; posture?: string | null }) {
  const { width } = useWindowDimensions()
  return <View style={{ flexDirection: 'column-reverse', gap: spacing.xs }}>
    <AppText testID="part-role" accessibilityLabel={capitalized(role)} variant={width >= 700 ? 'feature' : 'heading'} style={{ textTransform: 'capitalize' }}>{role}</AppText>
    {posture ? <AppText testID="part-posture" accessibilityLabel={`${capitalized(posture)}.`} variant="eyebrow" tone="muted" style={{ textTransform: 'uppercase' }}>{posture}</AppText> : null}
  </View>
}

export function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
