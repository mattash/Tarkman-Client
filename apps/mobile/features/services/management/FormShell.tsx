import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useNavigation } from 'expo-router'
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation'
import { AppButton } from '../../../components/AppButton'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { spacing } from '../../../design/tokens'
import { useTheme } from '../../../design/ThemeProvider'
import { useI18n } from '../../i18n'

export interface FormShellProps {
  title: string
  intro?: string
  /** Guard navigation away (dirty draft, or a write whose outcome is still open). */
  guarded: boolean
  error?: string | null
  otherErrors?: string[]
  onCancel(): void
  footer?: ReactNode
  children: ReactNode
}

/** Scrollable, keyboard-avoiding page for the management forms, with a sticky commit bar and an unsaved-changes guard. */
export function FormShell({ title, intro, guarded, error, otherErrors = [], onCancel, footer, children }: FormShellProps) {
  const { t } = useI18n(), { colors } = useTheme(), navigation = useNavigation()
  const [pending, setPending] = useState<NavigationAction | null>(null), [discard, setDiscard] = useState(false)
  const cancelRef = useRef<View>(null)
  usePreventRemove(guarded && !discard, ({ data }) => setPending(data.action))
  useEffect(() => { if (discard && pending) navigation.dispatch(pending) }, [discard, pending, navigation])
  useEffect(() => { if (error && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(error) }, [error])
  useEffect(() => {
    if (Platform.OS !== 'web' || !guarded) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guarded])

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md }}>
        <View style={{ alignSelf: 'flex-start' }}><AppButton ref={cancelRef} variant="text" onPress={onCancel}>{t('common.cancel')}</AppButton></View>
        <AppText variant="screenTitle" accessibilityRole="header">{title}</AppText>
        {intro && <AppText tone="muted">{intro}</AppText>}
        {guarded && <AppText variant="caption" accessibilityLiveRegion="polite">{t('sessionManagement.unsaved')}</AppText>}
        {(error || otherErrors.length > 0) && <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
          style={{ gap: spacing.xs, padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSurface }}>
          {error && <AppText tone="destructive">{error}</AppText>}
          {otherErrors.map(message => <AppText key={message} tone="destructive">{message}</AppText>)}
        </View>}
        {children}
      </View>
    </ScrollView>
    {footer && <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, borderTopWidth: 1,
      borderTopColor: colors.divider, backgroundColor: colors.surface }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.sm }}>{footer}</View>
    </View>}
    <AppModal visible={!!pending && !discard} onDismiss={() => setPending(null)} title={t('sessionManagement.unsaved')} openerRef={cancelRef}>
      <AppText>{t('sessionManagement.discardHelp')}</AppText>
      <AppButton variant="destructive" onPress={() => setDiscard(true)}>{t('sessionManagement.discard')}</AppButton>
      <AppButton variant="secondary" onPress={() => setPending(null)}>{t('sessionManagement.keepEditing')}</AppButton>
    </AppModal>
  </KeyboardAvoidingView>
}
