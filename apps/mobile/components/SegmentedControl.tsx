import { View, useWindowDimensions } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppButton } from './AppButton'

export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void
}) {
  const { colors } = useTheme()
  const { fontScale, width } = useWindowDimensions()
  const stacked = fontScale > 1.3 || width < 360
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}
    style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.xs, padding: spacing.xs, backgroundColor: colors.background, borderRadius: radii.control }}>
    {options.map(option => <View key={option.value} style={{ flex: stacked ? undefined : 1 }}>
      <AppButton accessibilityRole="radio" variant="quiet" selected={value === option.value} accessibilityLabel={`${label}, ${option.label}`}
        accessibilityState={{ selected: value === option.value, checked: value === option.value }} onPress={() => onChange(option.value)}>{option.label}</AppButton>
    </View>)}
  </View>
}
