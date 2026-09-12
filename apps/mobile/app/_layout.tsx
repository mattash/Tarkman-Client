import '../global.css'
import { Stack } from 'expo-router'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider, useTheme } from '../design/ThemeProvider'
import { ReadingFontProvider } from '../design/ReadingFontProvider'
import { AuthProvider } from '../features/auth/AuthProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { readerConfig } from '../features/live/config'

export default function RootLayout() {
  return <SafeAreaProvider><ThemeProvider><RootContent /></ThemeProvider></SafeAreaProvider>
}
function RootContent() {
  const { colors, scheme } = useTheme()
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <ReadingFontProvider><PreferencesProvider><AuthProvider apiBase={readerConfig().endpoints?.api}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthProvider></PreferencesProvider></ReadingFontProvider>
  </SafeAreaView>
}
