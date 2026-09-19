import type { PropsWithChildren } from 'react'
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { AppText } from '../../components/AppText'
import { ThemeProvider, useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { useScreenKeepAwake } from '../keepAwake/useScreenKeepAwake'

export function DisplayFrame({ children }: PropsWithChildren) {
  useScreenKeepAwake('tarkman-display')
  return <ThemeProvider scheme="dark"><Canvas>{children}</Canvas></ThemeProvider>
}
function Canvas({ children }: PropsWithChildren) {
  const { colors } = useTheme()
  return <View style={[styles.canvas, { backgroundColor: colors.background }]}>
    <StatusBar hidden />{children}
  </View>
}
export function DisplayNotice({ title, detail, busy = false, testID }: { title: string; detail?: string; busy?: boolean; testID?: string }) {
  const { width } = useWindowDimensions()
  const { colors } = useTheme()
  const size = Math.max(28, Math.min(64, width / 28))
  return <View testID={testID} style={styles.notice}>
    {busy && <ActivityIndicator color={colors.muted} accessibilityLabel={title} />}
    <AppText variant="title" style={{ fontSize: size, lineHeight: size * 1.25, textAlign: 'center' }}>{title}</AppText>
    {detail && <AppText tone="muted" style={{ fontSize: Math.max(18, size * 0.5), textAlign: 'center' }}>{detail}</AppText>}
  </View>
}
const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 0 },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
})
