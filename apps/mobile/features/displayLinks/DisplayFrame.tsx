import { useState, type PropsWithChildren, type ReactNode } from 'react'
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
/**
 * Setup preview stage: the dark projection surface at a fixed height, measured so the display
 * lays out against this stage instead of the application window. No keep-awake or status bar.
 */
export function PreviewStage({ height = 420, children }: { height?: number; children: (size: { width: number; height: number }) => ReactNode }) {
  return <ThemeProvider scheme="dark"><Stage height={height}>{children}</Stage></ThemeProvider>
}
function Stage({ height, children }: { height: number; children: (size: { width: number; height: number }) => ReactNode }) {
  const { colors } = useTheme()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  return <View testID="display-preview-stage" style={{ height, overflow: 'hidden', backgroundColor: colors.background }}
    onLayout={event => {
      const { width, height: measured } = event.nativeEvent.layout
      setSize(previous => previous && previous.width === width && previous.height === measured ? previous : { width, height: measured })
    }}>
    {size && size.width > 0 ? children(size) : null}
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
