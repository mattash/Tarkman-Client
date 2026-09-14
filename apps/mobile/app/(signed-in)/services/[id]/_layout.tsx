import { Stack, useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../../design/ThemeProvider'
import { radii } from '../../../../design/tokens'
import { ServiceControlProvider } from '../../../../features/services/ServiceControlProvider'

/** Service control and its Service sheet share one reader connection and one command runner. */
export default function ServiceControlLayout() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { colors } = useTheme()
  const sessionId = Number(id)
  return <ServiceControlProvider key={sessionId} sessionId={sessionId}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* The turn 2 sheet: grabber, 24pt top radius, dimmed backdrop. It opens tall because the composer needs a keyboard;
          the short detent leaves the status rows reachable with the part text visible above. */}
      <Stack.Screen name="service" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.92], sheetInitialDetentIndex: 'last',
        sheetGrabberVisible: true, sheetCornerRadius: radii.sheet, sheetExpandsWhenScrolledToEdge: true,
        contentStyle: { backgroundColor: colors.overlay } }} />
      <Stack.Screen name="languages" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 0.92], sheetInitialDetentIndex: 0,
        sheetGrabberVisible: true, sheetCornerRadius: radii.sheet, sheetExpandsWhenScrolledToEdge: true,
        contentStyle: { backgroundColor: colors.overlay } }} />
    </Stack>
  </ServiceControlProvider>
}
