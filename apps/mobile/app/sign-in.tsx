import { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { AppButton } from '../components/AppButton'
import { AppText } from '../components/AppText'
import { TextField } from '../components/TextField'
import { spacing } from '../design/tokens'
import { useAuth } from '../features/auth/AuthProvider'
import { safeReturnTo } from '../features/auth/returnTo'

export default function SignInScreen() {
  const { state, signIn } = useAuth()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }}>
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: spacing.lg }}>
        <AppText variant="label" tone="accent">TARKMAN / SIGN IN</AppText>
        <AppText variant="title">Sign in</AppText>
        <AppText tone="muted">Sign in to see the services you manage.</AppText>
        {state.expired && <AppText accessibilityRole="alert">Your sign-in has ended. Sign in again to continue.</AppText>}
        <TextField label="Email" value={email} onChangeText={setEmail} editable={!pending} autoCapitalize="none" autoCorrect={false}
          autoComplete="email" textContentType="username" keyboardType="email-address" inputMode="email"
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordField.current?.focus()} />
        <TextField ref={passwordField} label="Password" value={password} onChangeText={setPassword} editable={!pending} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        {error && <AppText tone="destructive" accessibilityRole="alert">{error}</AppText>}
        <AppButton loading={pending} onPress={submit}>Sign in</AppButton>
        <AppButton variant="quiet" disabled={pending} onPress={() => router.replace('/')}>Back to live services</AppButton>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}
