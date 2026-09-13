import { useEffect, useRef, type PropsWithChildren, type RefObject, type ReactNode } from 'react'
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../design/ThemeProvider'
import { radii, spacing } from '../design/tokens'
import { AppText } from './AppText'
import { AppButton } from './AppButton'

export function AppModal({ visible, onDismiss, title, children, openerRef, headerAction, dismissLabel = 'Done' }: PropsWithChildren<{ visible: boolean; onDismiss: () => void; title: string; openerRef?: RefObject<View | null>; headerAction?: ReactNode; dismissLabel?: string }>) {
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
  const ios = Platform.OS === 'ios'
  return <Modal testID="app-modal" visible={visible} transparent={!ios} animationType={ios ? 'slide' : 'none'}
    presentationStyle={ios ? 'pageSheet' : 'overFullScreen'} allowSwipeDismissal onShow={() => focusControl(closeRef.current)}
    onDismiss={restore} onRequestClose={onDismiss} statusBarTranslucent={!ios}>
    <KeyboardAvoidingView behavior={ios ? 'padding' : 'height'} style={{ flex: 1, justifyContent: ios ? 'flex-start' : 'flex-end', backgroundColor: ios ? colors.overlay : colors.backdrop }}>
      {!ios && <Pressable accessible={false} focusable={false} importantForAccessibility="no" testID="modal-backdrop" onPress={onDismiss} style={{ position: 'absolute', inset: 0 }} />}
      <View testID="modal-shell" accessibilityViewIsModal onAccessibilityEscape={onDismiss} style={{ backgroundColor: colors.overlay, flex: ios ? 1 : undefined, maxHeight: ios ? '100%' : '90%', width: '100%', maxWidth: 680,
        alignSelf: 'center', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet,
        paddingTop: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), paddingLeft: Math.max(insets.left, spacing.lg), paddingRight: Math.max(insets.right, spacing.lg), gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="heading" style={{ flex: 1 }}>{title}</AppText>
          <AppButton ref={closeRef} variant="quiet" onPress={onDismiss} accessibilityLabel={`Close ${title}`}>{dismissLabel}</AppButton>
          {headerAction}
        </View>
        <ScrollView testID="modal-content" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: spacing.md }}>
          {children}
        </ScrollView>
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
