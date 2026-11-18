import { useRef, type ComponentRef } from 'react'
import { I18nManager, Platform, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppButton } from './AppButton'

export function SegmentedControl<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void; disabled?: boolean
}) {
  const { colors } = useTheme()
  const { fontScale, width } = useWindowDimensions()
  const stacked = fontScale > 1.3 || width < 360
  const buttons = useRef<Record<string, ComponentRef<typeof View> | null>>({})
  // Keep an entry point even when a controlled value is no longer in the options.
  const tabStop = Math.max(0, options.findIndex(option => option.value === value))
  // RN's shared event type omits the web-only key/modifier fields.
  function onKeyDown(event: { key?: string; preventDefault(): void; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }, index: number) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey || !options.length) { return }
    let next: number
    const previousKey = stacked ? 'ArrowUp' : I18nManager.isRTL ? 'ArrowRight' : 'ArrowLeft'
    const nextKey = stacked ? 'ArrowDown' : I18nManager.isRTL ? 'ArrowLeft' : 'ArrowRight'
    if (event.key === previousKey) { next = (index - 1 + options.length) % options.length }
    else if (event.key === nextKey) { next = (index + 1) % options.length }
    else if (event.key === 'Home') { next = 0 }
    else if (event.key === 'End') { next = options.length - 1 }
    else { return }
    event.preventDefault()
    buttons.current[options[next].value]?.focus()
    if (options[next].value !== value) { onChange(options[next].value) }
  }
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}
    {...(Platform.OS === 'web' ? { 'aria-orientation': stacked ? 'vertical' : 'horizontal' } : {})}
    style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.xs, padding: spacing.xs, backgroundColor: colors.background, borderRadius: radii.control }}>
    {options.map((option, index) => <View key={option.value} style={{ flex: stacked ? undefined : 1 }}>
      <AppButton accessibilityRole="radio" variant="quiet" selected={value === option.value} disabled={disabled} accessibilityLabel={`${label}, ${option.label}`}
        {...(Platform.OS === 'web' ? {
          ref: (node: ComponentRef<typeof View> | null) => { buttons.current[option.value] = node },
          tabIndex: !disabled && index === tabStop ? 0 : -1,
          onKeyDown: (event: Parameters<typeof onKeyDown>[0]) => onKeyDown(event, index),
        } : {})}
        accessibilityState={{ selected: value === option.value, checked: value === option.value }} onPress={() => onChange(option.value)}>{option.label}</AppButton>
    </View>)}
  </View>
}
