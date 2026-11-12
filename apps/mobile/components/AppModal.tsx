import { useEffect, useRef, type PropsWithChildren, type RefObject, type ReactNode } from 'react'
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppText } from './AppText'
import { AppButton } from './AppButton'
import { useI18n } from '../features/i18n'

export function AppModal({ visible, onDismiss, title, children, openerRef, headerAction, dismissLabel, onAfterDismiss, onAfterShow, restoreFocus = true }: PropsWithChildren<{ visible: boolean; onDismiss: () => void; title: string; openerRef?: RefObject<React.ComponentRef<typeof View> | null>; headerAction?: ReactNode; dismissLabel?: string; onAfterDismiss?: () => void; onAfterShow?: () => void; restoreFocus?: boolean }>) {
  const closeRef = useRef<React.ComponentRef<typeof View>>(null)
  const { t } = useI18n()
  const dismiss = dismissLabel ?? t('common.done')
  const wasVisible = useRef(false)
  const completion = useRef({ onAfterDismiss, restoreFocus })
  useEffect(() => { completion.current = { onAfterDismiss, restoreFocus } }, [onAfterDismiss, restoreFocus])
  const restore = () => { if (restoreFocus) focusControl(openerRef?.current); onAfterDismiss?.() }
  useEffect(() => {
    // Android does not expose Modal.onDismiss. No exit animation ensures the
    // next frame runs after removal; iOS/web restore after the dismissal event.
    if (wasVisible.current && !visible && Platform.OS === 'android') {
      const frame = requestAnimationFrame(() => { if (completion.current.restoreFocus) focusControl(openerRef?.current); completion.current.onAfterDismiss?.() })
      wasVisible.current = visible
      return () => cancelAnimationFrame(frame)
    }
    wasVisible.current = visible
  }, [visible, openerRef])
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const ios = Platform.OS === 'ios'
  return <Modal testID="app-modal" visible={visible} transparent={!ios} animationType={ios ? 'slide' : 'none'}
    presentationStyle={ios ? 'pageSheet' : 'overFullScreen'} allowSwipeDismissal onShow={() => { focusControl(closeRef.current); onAfterShow?.() }}
    onDismiss={restore} onRequestClose={onDismiss} statusBarTranslucent={!ios}>
    <KeyboardAvoidingView behavior={ios ? 'padding' : 'height'} style={{ flex: 1, justifyContent: ios ? 'flex-start' : 'flex-end', backgroundColor: ios ? colors.overlay : colors.backdrop }}>
      {!ios && <Pressable accessible={false} focusable={false} importantForAccessibility="no" testID="modal-backdrop" onPress={onDismiss} style={{ position: 'absolute', inset: 0 }} />}
      {/* Android needs a bounded height so the flex ScrollView cannot collapse to the header. */}
      <View testID="modal-shell" accessibilityViewIsModal onAccessibilityEscape={onDismiss} style={{ backgroundColor: colors.overlay, flex: ios ? 1 : undefined, height: Platform.OS === 'android' ? '90%' : undefined, maxHeight: ios ? '100%' : '90%', width: '100%', maxWidth: 680,
        alignSelf: 'center', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet,
        paddingTop: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), paddingLeft: Math.max(insets.left, spacing.lg), paddingRight: Math.max(insets.right, spacing.lg), gap: spacing.md }}>
        {/* A lone dismiss is an X at the top right; with a commit action, Cancel leads and the commit trails. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          {headerAction && <AppButton ref={closeRef} variant="text" onPress={onDismiss} accessibilityLabel={t('common.closeTitle', { title })}>{dismiss}</AppButton>}
          <AppText variant="heading" style={{ flex: 1 }}>{title}</AppText>
          {headerAction ?? <AppButton ref={closeRef} variant="quiet" icon="close" iconOnly onPress={onDismiss} accessibilityLabel={t('common.closeTitle', { title })}>{dismiss}</AppButton>}
        </View>
        <ScrollView testID="modal-content" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: spacing.md }}>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
}

function focusControl(target: React.ComponentRef<typeof View> | null | undefined) {
  if (!target) return
  if (Platform.OS === 'web') target.focus()
  else {
    const handle = findNodeHandle(target)
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }
}
