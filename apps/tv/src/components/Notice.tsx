import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { colors, space } from '../theme'
import { StatusIcon, type StatusIconName } from './StatusIcon'

/** A full-screen, distance-readable status message; the display's loading, waiting and error states. */
/** `icon` is opt-in: the running display's own notices stay plain text. */
export function Notice({ title, detail, busy = false, icon, testID }: { title: string; detail?: string; busy?: boolean; icon?: StatusIconName; testID?: string }) {
  const { width } = useWindowDimensions()
  const size = Math.max(28, Math.min(64, width / 28))
  return (
    <View testID={testID} style={styles.notice}>
      {icon ? <StatusIcon name={icon} /> : null}
      {busy ? <ActivityIndicator color={colors.textSecondary} size="large" accessibilityLabel={title} /> : null}
      <Text style={[styles.text, styles.title, { fontSize: size, lineHeight: size * 1.25 }]}>{title}</Text>
      {detail ? <Text style={[styles.muted, { fontSize: Math.max(18, size * 0.5), textAlign: 'center' }]}>{detail}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  text: { color: colors.textPrimary, textAlign: 'center', fontWeight: '600' },
  muted: { color: colors.textSecondary },
  // Mobile's notice title: AppText's title variant, in the Source Serif 4 semibold reading face.
  title: { fontFamily: 'SourceSerif4-Semibold', fontWeight: '400' },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
})
