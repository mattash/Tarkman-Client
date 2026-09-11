import { useEffect, useRef, type PropsWithChildren, type RefObject } from 'react'
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppText } from './AppText'
import { AppButton } from './AppButton'

export function AppModal({ visible, onDismiss, title, children, openerRef }: PropsWithChildren<{ visible: boolean; onDismiss: () => void; title: string; openerRef?: RefObject<View | null> }>) {
  const closeRef = useRef<View>(null)
  const wasVisible = useRef(false)
  const restore = () => focusControl(openerRef?.current)
  useEffect(() => {
    // Android does not expose Modal.onDismiss. No exit animation ensures the
    // next frame runs after removal; iOS/web restore after the dismissal event.
    if (wasVisible.current && !visible && Platform.OS === 'android') {
      const frame = requestAnimationFrame(() => focusControl(openerRef?.current))
      wasVisible.current = visible
      return () => cancelAnimationFrame(frame)
    }
    wasVisible.current = visible
  }, [visible, openerRef])
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return <Modal testID="app-modal" visible={visible} transparent animationType="none" onShow={() => focusControl(closeRef.current)} onDismiss={restore} onRequestClose={onDismiss} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }}>
      <Pressable accessible={false} focusable={false} importantForAccessibility="no" testID="modal-backdrop" onPress={onDismiss} style={{ position: 'absolute', inset: 0 }} />
      <View accessibilityViewIsModal onAccessibilityEscape={onDismiss} style={{ backgroundColor: colors.surface, maxHeight: '90%', width: '100%', maxWidth: 680,
        alignSelf: 'center', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet,
        paddingTop: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), paddingLeft: Math.max(insets.left, spacing.lg), paddingRight: Math.max(insets.right, spacing.lg), gap: spacing.md }}>
        <AppText variant="heading">{title}</AppText>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: spacing.md }}>{children}</ScrollView>
        <AppButton ref={closeRef} variant="secondary" onPress={onDismiss} accessibilityLabel={`Close ${title}`}>Close</AppButton>
      </View>
    </KeyboardAvoidingView>
  </Modal>
}

function focusControl(target: View | null | undefined) {
  if (!target) return
  if (Platform.OS === 'web') target.focus()
  else {
    const handle = findNodeHandle(target)
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }
}
