import { View, type ViewProps } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'

export function Surface({ style, ...props }: ViewProps) {
  const { colors } = useTheme()
  return <View {...props} style={[{ backgroundColor: colors.surface }, style]} />
}
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme()
  return <Surface {...props} style={[{
    backgroundColor: colors.raised,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  }, style]} />
}
