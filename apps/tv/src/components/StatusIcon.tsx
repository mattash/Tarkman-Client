import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors, glassSurface } from '../theme'
import { Glass } from './Glass'

export type StatusIconName = 'waiting' | 'warning' | 'lock' | 'update'

/**
 * A large decorative icon over a glass circle for full-screen status messages. The message text carries
 * the meaning, so the icon is hidden from screen readers. Never used on the running display.
 */
export function StatusIcon({ name }: { name: StatusIconName }) {
  const alert = name === 'warning'
  const stroke = alert ? colors.danger : colors.textPrimary
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glass radius={90} style={styles.circle} />
      {alert ? <View style={[styles.circle, styles.alertTint]} /> : null}
      <Svg width={84} height={84} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={styles.glyph}>
        {name === 'waiting' ? <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></> : null}
        {name === 'warning' ? <><Path d="M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" /><Path d="M12 9.5v4" /><Path d="M12 17h.01" /></> : null}
        {name === 'lock' ? <><Rect x={5} y={11} width={14} height={9} rx={2} /><Path d="M8 11V8a4 4 0 018 0v3" /></> : null}
        {name === 'update' ? <><Path d="M12 19V5" /><Path d="M5 12l7-7 7 7" /></> : null}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  circle: { ...StyleSheet.absoluteFill, borderRadius: 90 },
  alertTint: { backgroundColor: 'rgba(255,175,183,0.14)', borderWidth: 1, borderColor: glassSurface.edge },
  glyph: { position: 'absolute' },
})
