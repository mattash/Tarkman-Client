import { useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { AppButton } from '../components/AppButton'
import { AppText } from '../components/AppText'
import { Card } from '../components/Surface'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { readScannedLink } from '../features/scan/links'

export default function ScanScreen() {
  const { colors } = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [refused, setRefused] = useState<string>()
  // The camera reports the same code many times a second; only the first one may navigate.
  const handled = useRef(false)

  const leave = () => { if (router.canGoBack()) { router.back() } else { router.replace('/') } }

  function scanned(value: string) {
    if (handled.current) return
    const link = readScannedLink(value)
    if (link.kind === 'unknown') {
      // Never open what was scanned: a code in a public place can be replaced by anyone.
      handled.current = true
      setRefused(value.slice(0, 120))
      return
    }
    handled.current = true
    router.replace(link.path)
  }

  function scanAgain() {
    handled.current = false
    setRefused(undefined)
  }

  const frame = (children: React.ReactNode) => <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton variant="quiet" onPress={leave}>Live services</AppButton>
      </View>
      <AppText variant="title">Scan a service code</AppText>
      {children}
    </View>
  </ScrollView>

  if (!permission) return frame(<AppText tone="muted">Preparing the camera…</AppText>)

  if (!permission.granted) {
    return frame(<>
      <AppText tone="muted">Point your camera at the code printed in your service booklet, and the reading opens here.</AppText>
      <Card>
        <AppText variant="heading">The camera is not available yet</AppText>
        <AppText tone="muted">Tarkman uses the camera only to read a service code. Nothing is recorded or sent anywhere.</AppText>
        {permission.canAskAgain
          ? <AppButton onPress={() => { void requestPermission() }}>Allow the camera</AppButton>
          : <AppText accessibilityRole="alert">Camera access is turned off for Tarkman in the Settings app.</AppText>}
      </Card>
      <Card>
        <AppText variant="heading">You can still open a service</AppText>
        <AppText tone="muted">Enter the service ID printed beside the code.</AppText>
        <AppButton variant="secondary" onPress={() => router.replace('/')}>Enter a service ID</AppButton>
      </Card>
    </>)
  }

  return frame(<>
    <AppText tone="muted">Point your camera at the code printed in your service booklet.</AppText>
    <View accessibilityLabel="Camera viewfinder" style={{ height: 320, borderRadius: radii.control, overflow: 'hidden',
      backgroundColor: colors.foreground, justifyContent: 'center', alignItems: 'center' }}>
      <AppText tone="muted">Looking for a code…</AppText>
      <CameraView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scanned(data)} />
    </View>
    {refused && <Card>
      <AppText accessibilityRole="alert">That code does not open a Tarkman service, so nothing was opened.</AppText>
      <AppText variant="caption" tone="muted" selectable>{refused}</AppText>
      <AppButton variant="secondary" onPress={scanAgain}>Scan again</AppButton>
    </Card>}
  </>)
}
