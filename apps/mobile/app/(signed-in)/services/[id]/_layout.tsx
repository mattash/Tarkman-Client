import { Stack, useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../../../design/ThemeProvider'
import { radii } from '../../../../design/tokens'
import { liquidGlassSupported } from '../../../../design/liquidGlass'
import { ServiceControlProvider } from '../../../../features/services/ServiceControlProvider'
import { useScreenKeepAwake } from '../../../../features/keepAwake/useScreenKeepAwake'

/** Service control and its Service sheet share one reader connection and one command runner. */
export default function ServiceControlLayout() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { colors } = useTheme()
  const sessionId = Number(id)
  // On iOS 26 the system draws these sheets as glass at their partial detents, with its own corner radius.
  const glass = liquidGlassSupported()
  const sheet = glass
    ? { contentStyle: { backgroundColor: 'transparent' } }
    : { sheetCornerRadius: radii.sheet, contentStyle: { backgroundColor: colors.overlay } }
  useScreenKeepAwake('tarkman-service-control')
  return <ServiceControlProvider key={sessionId} sessionId={sessionId}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* The turn 2 sheet: grabber, 24pt top radius, dimmed backdrop. It opens tall because the composer needs a keyboard;
          the short detent leaves the status rows reachable with the part text visible above. */}
      <Stack.Screen name="service" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.92], sheetInitialDetentIndex: 'last',
        sheetGrabberVisible: true, sheetExpandsWhenScrolledToEdge: true, ...sheet }} />
      <Stack.Screen name="languages" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 0.92], sheetInitialDetentIndex: 0,
        sheetGrabberVisible: true, sheetExpandsWhenScrolledToEdge: true, ...sheet }} />
    </Stack>
  </ServiceControlProvider>
}
