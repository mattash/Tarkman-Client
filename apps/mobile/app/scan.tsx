import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppButton } from '../components/AppButton'
import { AppIcon } from '../components/AppIcon'
import { AppText } from '../components/AppText'
import { Notice } from '../components/Notice'
import { LivePill } from '../components/ServiceRow'
import { TextField } from '../components/TextField'
import { useTheme } from '../design/ThemeProvider'
import { radii, scanner, spacing, touchTarget } from '../design/tokens'
import { createApi } from '../features/live/api'
import { readerConfig } from '../features/live/config'
import type { LiveSession } from '../features/live/contracts'
import { readScannedLink, type ScannedLink } from '../features/scan/links'

type Found = Exclude<ScannedLink, { kind: 'unknown' }>
type Phase =
  | { kind: 'scanning' }
  | { kind: 'checking'; link: Found }
  | { kind: 'found'; link: Found; session: LiveSession }
  | { kind: 'unavailable' }
  | { kind: 'manual' }

/** A bad read stays on screen this long after the last one, so repeated reads do not re-announce. */
export const NOT_A_CODE_MS = 4000
const FRAME = 240

/**
 * Point the phone at the code on the church's screen. A scanned code is untrusted, and a camera can
 * pick one up from across a room, so a found code shows its service and waits for the reader.
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' })
  const [notCode, setNotCode] = useState(false)
  const asked = useRef(false)
  const lastBadRead = useRef(0)
  const config = readerConfig()
  const api = useMemo(() => config.endpoints ? createApi(config.endpoints.api) : null, [config.endpoints])

  // The camera is asked for when the scanner opens, never at launch.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true
      void requestPermission()
    }
  }, [permission, requestPermission])

  useEffect(() => {
    if (!notCode) return
    const timer = setInterval(() => { if (Date.now() - lastBadRead.current >= NOT_A_CODE_MS) setNotCode(false) }, 500)
    return () => clearInterval(timer)
  }, [notCode])

  const leave = () => { if (router.canGoBack()) { router.back() } else { router.replace('/') } }

  function scanned(value: string) {
    if (phase.kind !== 'scanning') return
    const link = readScannedLink(value)
    if (link.kind === 'unknown') {
      // Never open what was scanned: a code in a public place can be replaced by anyone.
      lastBadRead.current = Date.now()
      if (!notCode) setNotCode(true)
      return
    }
    setNotCode(false)
    setPhase({ kind: 'checking', link })
    if (!api) { router.replace(link.path); return }
    api.session(link.sessionId, new AbortController().signal).then(session => {
      setPhase({ kind: 'found', link, session })
      AccessibilityInfo.announceForAccessibility(`Found ${session.title} at ${session.church}${session.status === 'active' ? ', live' : ''}`)
    }, () => setPhase({ kind: 'unavailable' }))
  }

  const refused = !!permission && !permission.granted && !permission.canAskAgain
  const scanning = phase.kind === 'scanning' && !!permission?.granted

  return <View style={{ flex: 1, backgroundColor: scanner.canvas }}>
    <StatusBar style="light" />
    {permission?.granted && <CameraView testID="camera" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanning ? ({ data }) => scanned(data) : undefined} />}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.md), paddingLeft: insets.left, paddingRight: insets.right }}>
        <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          <Pressable testID="scan-close" accessibilityRole="button" accessibilityLabel="Close" accessibilityHint="Returns to Today" onPress={leave}
            style={{ width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: scanner.scrim }}>
            <AppIcon name="close" color={scanner.foreground} size={26} />
          </Pressable>
          <AppText variant="action" accessibilityRole="header" style={{ color: scanner.foreground, flexShrink: 1, textAlign: 'center' }}>Scan a code</AppText>
          <View style={{ width: touchTarget }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.page }}>
          <AppText style={{ marginTop: 30, color: scanner.muted, textAlign: 'center' }}>Point your camera at the code on your church’s screen.</AppText>
          <View style={{ flexGrow: 1, alignItems: 'center', paddingTop: 42, paddingBottom: spacing.lg }}>
            {phase.kind !== 'manual' && <Frame />}
          </View>
          <View style={{ gap: 14, alignItems: 'center' }}>
            {phase.kind === 'manual' ? <SessionIdEntry cancel={() => setPhase({ kind: 'scanning' })} />
              : refused ? <ResultCard>
                <AppText style={{ fontSize: 15, lineHeight: 23 }}>Tarkman needs the camera to scan a code. You can still open a service from the list or by session ID.</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <AppButton size="card" onPress={() => { void Linking.openSettings() }}>Open Settings</AppButton>
                  <AppButton size="card" variant="secondary" onPress={() => router.replace('/')}>Back to Today</AppButton>
                </View>
              </ResultCard>
              : phase.kind === 'found' ? <ResultCard testID="scan-found">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {phase.session.status === 'active' ? <LivePill label="Live" /> : null}
                  <View style={{ flex: 1 }}>
                    <AppText variant="rowTitle">{phase.session.title}</AppText>
                    <AppText variant="caption" tone="muted">{phase.session.church}</AppText>
                  </View>
                </View>
                <AppButton size="card" onPress={() => router.replace(phase.link.path)}
                  accessibilityHint={`Opens ${phase.session.title} at ${phase.session.church}`}>Read along</AppButton>
                <AppButton variant="quiet" onPress={() => setPhase({ kind: 'scanning' })}>Scan a different code</AppButton>
              </ResultCard>
              : phase.kind === 'unavailable' ? <ResultCard>
                <Notice tone="danger" accessibilityRole="alert">That service isn’t available. Try the code on your church’s screen.</Notice>
                <AppButton size="card" variant="secondary" onPress={() => setPhase({ kind: 'scanning' })}>Scan again</AppButton>
              </ResultCard>
              : notCode ? <ResultCard testID="scan-not-a-code">
                <Notice tone="danger" accessibilityRole="alert">That code isn’t a Tarkman service. Try the code on your church’s screen.</Notice>
              </ResultCard>
              : permission?.granted ? <LookingChip checking={phase.kind === 'checking'} /> : null}
            {phase.kind !== 'manual' && <Pressable testID="scan-session-id" accessibilityRole="button" onPress={() => { setNotCode(false); setPhase({ kind: 'manual' }) }}
              style={{ minHeight: touchTarget, paddingHorizontal: 20, justifyContent: 'center', borderRadius: touchTarget / 2, backgroundColor: scanner.scrim, marginTop: 24 }}>
              <AppText variant="label" style={{ color: scanner.foreground, textAlign: 'center' }}>Enter a session ID instead</AppText>
            </Pressable>}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </View>
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduce(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => { active = false; subscription.remove() }
  }, [])
  return reduce
}

/** Corners pulse 1.4s between 60% and 100%; no laser or sweep. Reduce Motion holds them still. */
function Frame() {
  const reduce = useReduceMotion()
  const [opacity] = useState(() => new Animated.Value(1))
  useEffect(() => {
    if (reduce) { opacity.setValue(1); return }
    const half = { duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 0.6, ...half }), Animated.timing(opacity, { toValue: 1, ...half })]))
    loop.start()
    return () => loop.stop()
  }, [reduce, opacity])
  const corner = { position: 'absolute', width: 46, height: 46, borderColor: scanner.foreground } as const
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: FRAME, height: FRAME, borderRadius: radii.sheet, backgroundColor: scanner.frame }}>
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}>
      <View style={{ ...corner, left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radii.feature }} />
      <View style={{ ...corner, right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radii.feature }} />
      <View style={{ ...corner, left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radii.feature }} />
      <View style={{ ...corner, right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radii.feature }} />
    </Animated.View>
  </View>
}

function LookingChip({ checking }: { checking: boolean }) {
  const reduce = useReduceMotion()
  // Kept out of the accessibility order so focus moves from the instruction straight to session ID entry.
  return <View accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 18, borderRadius: radii.card, backgroundColor: scanner.scrimStrong }}>
    {reduce ? <View style={{ width: 10, height: 10, borderRadius: 5, marginHorizontal: 5, backgroundColor: scanner.foreground }} />
      : <ActivityIndicator color={scanner.foreground} accessible={false} />}
    <AppText variant="label" style={{ color: scanner.foreground, fontWeight: '400' }}>{checking ? 'Checking the code…' : 'Looking for a code…'}</AppText>
  </View>
}

function ResultCard({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme()
  return <View testID={testID} style={{ alignSelf: 'stretch', padding: spacing.md, gap: 10, borderRadius: radii.card, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.raised }}>
    {children}
  </View>
}

function SessionIdEntry({ cancel }: { cancel(): void }) {
  const [input, setInput] = useState(''), [error, setError] = useState<string>()
  function submit() {
    const id = Number(input)
    if (!/^\d+$/.test(input) || !Number.isSafeInteger(id) || id <= 0) { setError('Enter a valid numeric session ID.'); return }
    Keyboard.dismiss()
    router.replace(`/sessions/${id}/parts`)
  }
  return <ResultCard testID="scan-manual">
    <AppText variant="rowTitle">Open a service by session ID</AppText>
    <AppText variant="caption" tone="muted">Use the number your church gives with the service.</AppText>
    <TextField testID="session-id" label="Session ID" value={input} autoFocus onChangeText={value => { setInput(value); setError(undefined) }}
      keyboardType="number-pad" inputMode="numeric" returnKeyType="go" onSubmitEditing={submit} error={error} />
    <AppButton size="card" onPress={submit}>Open session</AppButton>
    <AppButton variant="quiet" onPress={cancel}>Back to scanning</AppButton>
  </ResultCard>
}
