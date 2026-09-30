import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { glassSurface } from '../theme'

// The system's Liquid Glass needs tvOS 26; older systems (and tests) get a plain translucent surface.
function hasLiquidGlass(): boolean {
  try { return isLiquidGlassAvailable() } catch { return false }
}
const liquid = hasLiquidGlass()

/**
 * A glass surface: Liquid Glass where the system has it, otherwise a translucent fill with a fine edge.
 * Content goes inside; it always lays out like a View, so callers size and pad it with `style`.
 */
export function Glass({ radius, style, children, testID }: { radius: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string }) {
  if (liquid) {
    return <GlassView testID={testID} glassEffectStyle="regular" colorScheme="dark" style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>{children}</GlassView>
  }
  return <View testID={testID} style={[styles.fallback, { borderRadius: radius }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: glassSurface.fill, borderWidth: 1, borderColor: glassSurface.edge, overflow: 'hidden' },
})
