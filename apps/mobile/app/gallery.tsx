import { useRef, useState } from 'react'
import { Redirect, router } from 'expo-router'
import * as Sentry from '@sentry/react-native'
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { AppText } from '../components/AppText'
import { AppButton } from '../components/AppButton'
import { Card } from '../components/Surface'
import { TextField } from '../components/TextField'
import { AppModal } from '../components/AppModal'
import { LiturgyText } from '../components/LiturgyText'
import { ThemeProvider, useTheme } from '../design/ThemeProvider'
import { prayer, marksSample, sampleLanguages } from '../design/samples'
import fontLicense from '../assets/fonts/license.json'
import { observabilityConfig } from '../features/observability/sentry'
import { spacing, type ThemeName } from '../design/tokens'

/** A developer specimen of the design system. It is not part of the shipped app. */
export default function GalleryScreen() {
  if (!__DEV__) return <Redirect href="/" />
  return <HomeScreen />
}

function HomeScreen() {
  const { colors } = useTheme()
  const readingOpener = useRef<View>(null)
  const licenseOpener = useRef<View>(null)
  const activeOpener = useRef<View>(null)
  const [modal, setModal] = useState<'reading' | 'license' | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('Try an action below.')
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <View className="w-full max-w-3xl self-center gap-section">
        <AppButton variant="quiet" onPress={() => router.replace('/')}>Live services</AppButton>
        <View className="gap-4" style={{ borderTopWidth: 4, borderTopColor: colors.primary, paddingTop: spacing.lg }}>
          <AppText variant="label" tone="accent">TARKMAN / MOBILE</AppText>
          <AppText variant="title">A space for prayer.</AppText>
          <AppText tone="muted">Reading, language, and the small details that bring a service closer.</AppText>
          <AppText variant="caption" tone="muted">Design gallery · Static liturgy samples</AppText>
        </View>
        <View className="gap-4">
          <AppText variant="heading">01 / Words & languages</AppText>
          <AppText tone="muted">One prayer, four ways to follow. Press and hold the reading text to select it.</AppText>
          {sampleLanguages.map(language => <Card key={language.value}>
            <AppText variant="label" tone="accent" language={language.value}>{language.label}</AppText>
            <LiturgyText language={language.value} text={prayer[language.value]} />
          </Card>)}
          <Card><AppText variant="label">Punctuation & combining marks</AppText>
            <LiturgyText language="grabar" text={marksSample} />
            <AppText variant="caption" tone="muted">Decomposed accent stress sample alongside Armenian punctuation.</AppText>
          </Card>
        </View>
        <View className="gap-4">
          <AppText variant="heading">02 / Reading resilience</AppText>
          <Card><AppText variant="label">Long reading & limited Markdown</AppText>
            <LiturgyText text={'In the quiet of this gathering, we listen together. Words may fill many lines, and every line should have room to breathe. '.repeat(4) + '\n\n**Bold reading**, *gentle emphasis*, and `inline code`. [Noto Armenian](https://notofonts.github.io/armenian/)\n<No HTML is rendered.> [Unsafe link](javascript:alert)\nA line break stays a line break.'} />
          </Card>
          <Card><AppText variant="label">Missing translation · null</AppText><LiturgyText language="grabar" text={null} />
            <AppText variant="label">Empty translation</AppText><LiturgyText text="" /></Card>
        </View>
        <View className="gap-4">
          <AppText variant="heading">03 / Light & dark</AppText>
          {(['light', 'dark'] as ThemeName[]).map(scheme => <ThemeProvider key={scheme} scheme={scheme}><ThemeSample scheme={scheme} /></ThemeProvider>)}
        </View>
        <View className="gap-4">
          <AppText variant="heading">04 / Actions & input</AppText>
          <Card>
            <AppButton ref={readingOpener} onPress={() => { activeOpener.current = readingOpener.current; setModal('reading') }}>Open reading sheet</AppButton>
            <AppButton variant="secondary" onPress={() => setMessage('Reading saved for this preview.')}>Save reading</AppButton>
            <AppButton variant="quiet" onPress={() => setMessage('Preview reset.')}>Reset preview</AppButton>
            <AppButton variant="destructive" onPress={() => { setNote(''); setMessage('Preview note cleared.') }}>Clear note</AppButton>
            <AppButton loading>Preparing reading</AppButton>
            <AppButton disabled>Unavailable</AppButton>
            <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">{message}</AppText>
            <TextField label="Reading note" placeholder="Add a thought…" value={note} onChangeText={setNote} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            <TextField label="Email keyboard sample" placeholder="reader@example.org" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
            <TextField label="Field with feedback" value="" editable={false} error="This sample is read-only." />
          </Card>
        </View>
        <ErrorReportingSample />
        <AppButton ref={licenseOpener} variant="quiet" onPress={() => { activeOpener.current = licenseOpener.current; setModal('license') }}>Font license & attribution</AppButton>
        <AppText variant="caption" tone="muted">Made for unhurried reading. Text follows your device’s size and appearance settings.</AppText>
      </View>
    </ScrollView>
    <AppModal openerRef={activeOpener} visible={modal !== null} title={modal === 'license' ? 'Font license' : 'The Lord’s Prayer'} onDismiss={() => setModal(null)}>
      {modal === 'license' ? <AppText selectable variant="caption">{fontLicense.text}</AppText> : <>
      <LiturgyText language="grabar" text={prayer.grabar} />
      <TextField label="Sheet note" placeholder="Try typing here…" multiline />
      <AppText variant="caption" tone="muted">Close with the button, tap outside, or use your device’s back action.</AppText>
      </>}
    </AppModal>
  </KeyboardAvoidingView>
}
function ErrorReportingSample() {
  const config = observabilityConfig()
  const [sent, setSent] = useState<string>()
  // Development builds only: a deliberate error, so error reporting can be proved end to end.
  if (!__DEV__) return null
  return <Card>
    <AppText variant="label" tone="accent">Error reporting</AppText>
    <AppText tone="muted">{config.enabled ? `Reporting to Sentry as "${config.environment}".` : 'No Sentry DSN is configured, so nothing is reported.'}</AppText>
    <AppButton variant="secondary" disabled={!config.enabled} onPress={() => {
      const id = Sentry.captureException(new Error('Tarkman controlled test error'))
      setSent(id)
    }}>Send a test error</AppButton>
    {sent && <AppText variant="caption" accessibilityLiveRegion="polite">{`Sent. Event ${sent}.`}</AppText>}
  </Card>
}
function ThemeSample({ scheme }: { scheme: ThemeName }) {
  return <Card><AppText variant="label" tone="accent">{scheme === 'light' ? 'Light / Daytime reading' : 'Dark / Evening reading'}</AppText>
    <LiturgyText language="grabar" text="Տէ՛ր, ողորմեա։" />
    <AppText tone="muted">Lord, have mercy.</AppText>
  </Card>
}
