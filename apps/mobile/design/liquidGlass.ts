import { Platform } from 'react-native'
import { useTheme } from './ThemeProvider'

/** The system draws Liquid Glass only on iOS 26 and later. Everything else keeps the app's own surfaces. */
export const LIQUID_GLASS_MIN_IOS = 26

/** `Platform.Version` is a string such as "26.5" on iOS; anything unreadable counts as unsupported. */
export function liquidGlassSupported(version: string | number = Platform.Version, os: string = Platform.OS): boolean {
  if (os !== 'ios') return false
  const major = typeof version === 'number' ? version : Number.parseInt(version, 10)
  return Number.isFinite(major) && major >= LIQUID_GLASS_MIN_IOS
}

/**
 * The background a native form sheet's content should paint. On iOS 26 the system draws a glass sheet at
 * partial detents, so content must not cover it; elsewhere the sheet keeps the app's overlay color.
 */
export function useSheetBackground(): string {
  const { colors } = useTheme()
  return liquidGlassSupported() ? 'transparent' : colors.overlay
}
