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
import { useI18n } from '../features/i18n'

/** Operators only, reached from Settings. Reading along never needs an account. */
export default function SignInScreen() {
  const { state, signIn } = useAuth()
  const { colors } = useTheme()
  const { t } = useI18n()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const inFlight = useRef(false)
  const passwordField = useRef<React.ComponentRef<typeof TextInput>>(null)
  if (state.status === 'signedIn') return <Redirect href={safeReturnTo(returnTo)} />
  if (state.status === 'hydrating') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel={t('common.checkingSignIn')} /></View>

  async function submit() {
    // A ref, not state, so a fast double tap cannot send two sign-in requests before the button disables.
    if (inFlight.current) return
    if (!email.trim() || !password) { setError(t('signIn.enterBoth')); return }
    inFlight.current = true
    setPending(true)
    setError(undefined)
    try {
      await signIn({ email: email.trim(), password })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('signIn.failed'))
      setPassword('')
      setPending(false)
    } finally {
      inFlight.current = false
    }
  }

  const back = () => { if (router.canGoBack()) { router.back() } else { router.replace('/settings') } }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <View style={{ minHeight: 52, paddingHorizontal: spacing.md - 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.settings')} accessibilityHint={t('signIn.settingsHint')} disabled={pending} onPress={back}
        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <AppIcon name="back" color={colors.primary} size={22} />
        <AppText variant="label" tone="accent">{t('common.settings')}</AppText>
      </Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: 28, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="feature">{t('common.signIn')}</AppText>
          <AppText tone="muted">{t('signIn.intro')}</AppText>
        </View>
        {state.expired && <AppText accessibilityRole="alert">{t('signIn.expired')}</AppText>}
        {error && <Notice tone="danger" accessibilityRole="alert">{error}</Notice>}
        <View style={{ gap: spacing.md }}>
          <TextField testID="sign-in-email" label={t('signIn.email')} value={email} onChangeText={setEmail} editable={!pending} autoCapitalize="none" autoCorrect={false}
            autoComplete="email" textContentType="username" keyboardType="email-address" inputMode="email"
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordField.current?.focus()} />
          <TextField ref={passwordField} testID="sign-in-password" label={t('signIn.password')} value={password} onChangeText={setPassword} editable={!pending} secureTextEntry={!revealed}
            autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}
            trailing={<Pressable accessibilityRole="button" accessibilityLabel={revealed ? t('signIn.hidePassword') : t('signIn.showPassword')} onPress={() => setRevealed(value => !value)}
              style={{ minHeight: touchTarget, minWidth: touchTarget, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label" tone="accent">{revealed ? t('signIn.hide') : t('signIn.show')}</AppText>
            </Pressable>} />
          <AppButton testID="sign-in-submit" size="form" loading={pending} onPress={submit}>{t('common.signIn')}</AppButton>
        </View>
        <Notice tone="neutral">{t('signIn.accountsNote')}</Notice>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}
