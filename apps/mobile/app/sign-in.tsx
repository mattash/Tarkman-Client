import { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../components/AppButton'
import { AppIcon } from '../components/AppIcon'
import { AppText } from '../components/AppText'
import { Notice } from '../components/Notice'
import { TextField } from '../components/TextField'
import { useTheme } from '../design/ThemeProvider'
import { spacing, touchTarget } from '../design/tokens'
import { useAuth } from '../features/auth/AuthProvider'
import { safeReturnTo } from '../features/auth/returnTo'

/** Operators only, reached from Settings. Reading along never needs an account. */
export default function SignInScreen() {
  const { state, signIn } = useAuth()
  const { colors } = useTheme()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const inFlight = useRef(false)
  const passwordField = useRef<TextInput>(null)
  if (state.status === 'signedIn') return <Redirect href={safeReturnTo(returnTo)} />
  if (state.status === 'hydrating') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Checking your sign-in" /></View>

  async function submit() {
    // A ref, not state, so a fast double tap cannot send two sign-in requests before the button disables.
    if (inFlight.current) return
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    inFlight.current = true
    setPending(true)
    setError(undefined)
    try {
      await signIn({ email: email.trim(), password })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in. Please try again.')
      setPassword('')
      setPending(false)
    } finally {
      inFlight.current = false
    }
  }

  const back = () => { if (router.canGoBack()) { router.back() } else { router.replace('/settings') } }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <View style={{ minHeight: 52, paddingHorizontal: spacing.md - 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" accessibilityHint="Returns to Settings" disabled={pending} onPress={back}
        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <AppIcon name="back" color={colors.primary} size={22} />
        <AppText variant="label" tone="accent">Settings</AppText>
      </Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: 28, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="feature">Sign in</AppText>
          <AppText tone="muted">For clergy and parish staff who run services. Reading along never needs an account.</AppText>
        </View>
        {state.expired && <AppText accessibilityRole="alert">Your sign-in has ended. Sign in again to continue.</AppText>}
        {error && <Notice tone="danger" accessibilityRole="alert">{error}</Notice>}
        <View style={{ gap: spacing.md }}>
          <TextField label="Email" value={email} onChangeText={setEmail} editable={!pending} autoCapitalize="none" autoCorrect={false}
            autoComplete="email" textContentType="username" keyboardType="email-address" inputMode="email"
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordField.current?.focus()} />
          <TextField ref={passwordField} label="Password" value={password} onChangeText={setPassword} editable={!pending} secureTextEntry={!revealed}
            autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}
            trailing={<Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Hide password' : 'Show password'} onPress={() => setRevealed(value => !value)}
              style={{ minHeight: touchTarget, minWidth: touchTarget, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label" tone="accent">{revealed ? 'Hide' : 'Show'}</AppText>
            </Pressable>} />
          <AppButton size="form" loading={pending} onPress={submit}>Sign in</AppButton>
        </View>
        <Notice tone="neutral">Accounts are created on the Tarkman website, not in the app.</Notice>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}
