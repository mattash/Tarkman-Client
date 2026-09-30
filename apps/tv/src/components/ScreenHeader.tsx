import { Image, StyleSheet, Text, View } from 'react-native'
import logo from '../../assets/images/logo.png'
import { colors, space, type } from '../theme'

/**
 * The mark beside a screen's title. The mark is decorative (the title, and the brand line when given,
 * already name the app), so screen readers do not announce it a second time.
 */
export function ScreenHeader({ title, brand }: { title: string; brand?: string }) {
  const size = brand ? 112 : 88
  return (
    <View style={styles.header}>
      <Image source={logo} accessible={false} importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size * 0.23 }} />
      <View style={styles.text}>
        {brand ? <Text style={styles.brand}>{brand}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flexShrink: 1 },
  brand: { color: colors.textSecondary, fontSize: type.label, fontWeight: '600', letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
})
