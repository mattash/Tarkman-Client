import '../global.css'
import * as Sentry from '@sentry/react-native'
import { Stack } from 'expo-router'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider, useTheme } from '../design/ThemeProvider'
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <ReadingFontProvider><AuthProvider apiBase={readerConfig().endpoints?.api}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthProvider></ReadingFontProvider>
  </SafeAreaView>
}

export default Sentry.wrap(RootLayout)
