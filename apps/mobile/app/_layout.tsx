import '../global.css'
import * as Sentry from '@sentry/react-native'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider, useTheme } from '../design/ThemeProvider'
import { scanner } from '../design/tokens'
import { ReadingFontProvider } from '../design/ReadingFontProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider'
import { readerConfig } from '../features/live/config'
import { startObservability } from '../features/observability/sentry'

// Starts before the first screen so a crash during startup is still reported.
startObservability()

function RootLayout() {
  return <SafeAreaProvider><PreferencesProvider><PreferenceTheme /></PreferencesProvider></SafeAreaProvider>
}
function PreferenceTheme() {
  const { preferences } = usePreferences()
  return <ThemeProvider appearance={preferences.appearance}><RootContent /></ThemeProvider>
}
function RootContent() {
  const { colors, scheme } = useTheme()
  const insets = useSafeAreaInsets()
  // Each screen owns its safe area, so the tab bar can reach the home indicator and the scanner can fill the display.
  const safe = { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <ReadingFontProvider><AuthProvider apiBase={readerConfig().endpoints?.api}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background, ...safe } }}>
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: colors.background, ...safe, paddingBottom: 0 } }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: scanner.canvas } }} />
      </Stack>
    </AuthProvider></ReadingFontProvider>
  </GestureHandlerRootView>
}

export default Sentry.wrap(RootLayout)
