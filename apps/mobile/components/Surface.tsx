import { View, type ViewProps } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { elevation, radii, spacing } from '../design/tokens'

export function Surface({ style, ...props }: ViewProps) {
  const { colors } = useTheme()
  return <View {...props} style={[{ backgroundColor: colors.surface }, style]} />
}
export function Card({ style, ...props }: ViewProps) {
  return <Surface {...props} style={[elevation.card, { borderRadius: radii.card, padding: spacing.lg, gap: spacing.md }, style]} />
}
