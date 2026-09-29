import { StyleSheet, View } from 'react-native'
import { colors } from '../theme'

/**
 * The soft plum and violet light behind every non-display screen, so glass has something to refract.
 * It sits behind the whole app; a running display draws its own opaque canvas over it.
 */
/** A soft glow: a radial gradient fading to transparent (React Native has no blur filter on tvOS). */
function Glow({ color, style }: { color: string; style: object }) {
  return <View style={[styles.glow, style, { experimental_backgroundImage: `radial-gradient(circle closest-side, ${color}, rgba(0,0,0,0))` }]} />
}

export function Backdrop() {
  return (
    <View pointerEvents="none" style={styles.fill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glow color="rgba(140,63,104,0.85)" style={{ left: -420, top: -460, width: 1500, height: 1500 }} />
      <Glow color="rgba(75,58,143,0.75)" style={{ right: -480, top: -60, width: 1400, height: 1400 }} />
      <Glow color="rgba(181,88,127,0.6)" style={{ left: 380, bottom: -760, width: 1500, height: 1300 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfaceCanvas, overflow: 'hidden' },
  glow: { position: 'absolute' },
})
