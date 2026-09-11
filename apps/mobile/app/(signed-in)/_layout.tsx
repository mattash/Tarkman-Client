import { ActivityIndicator, View } from 'react-native'
import { Redirect, Stack, usePathname } from 'expo-router'
import { useTheme } from '../../design/ThemeProvider'
import { useAuth } from '../../features/auth/AuthProvider'

/** Guards every screen in this group: waits for stored sign-in to load, then sends signed-out visitors to sign in and back. */
export default function SignedInLayout() {
  const { state } = useAuth()
  const pathname = usePathname()
  const { colors } = useTheme()
  if (state.status === 'hydrating') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Checking your sign-in" /></View>
  if (state.status === 'signedOut') return <Redirect href={{ pathname: '/sign-in', params: { returnTo: pathname } }} />
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
}
