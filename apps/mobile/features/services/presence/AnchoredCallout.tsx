import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { AppText } from '../../../components/AppText'
import { useTheme } from '../../../design/ThemeProvider'
import { radii, spacing } from '../../../design/tokens'
import { useI18n } from '../../i18n'

function focus(target: React.ComponentRef<typeof View> | null) {
  if (!target) return
  if (Platform.OS === 'web') (target as unknown as HTMLElement).focus()
  else {
    const handle = findNodeHandle(target)
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }
}

/** A small, anchored explanation with only its trigger in the normal layout. */
export function AnchoredCallout({ label, title, children, trigger, testID }: {
  label: string
  title: string
  children: ReactNode
  trigger: ReactNode
  testID: string
}) {
  const { colors } = useTheme()
  const { t } = useI18n()
  const { width, height } = useWindowDimensions()
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null)
  const titleRef = useRef<React.ComponentRef<typeof View>>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 48, height: 48 })
  const measureAnchor = () => triggerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
    setAnchor({ x, y, width: measuredWidth, height: measuredHeight })
  })
  const show = () => {
    setOpen(true)
    measureAnchor()
  }
  const close = () => { setOpen(false); requestAnimationFrame(() => focus(triggerRef.current)) }
  const popWidth = Math.min(width - 28, 320)
  const left = Math.max(14, Math.min(anchor.x + anchor.width / 2 - popWidth / 2, width - popWidth - 14))
  const top = anchor.y + anchor.height + spacing.xs

  return <>
    <Pressable ref={triggerRef} testID={`${testID}-trigger`} accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint={t('presence.showDetails')} accessibilityState={{ expanded: open }} onLayout={measureAnchor} onPress={show}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      {trigger}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={close}
      onShow={() => focus(titleRef.current)} onDismiss={() => focus(triggerRef.current)}>
      <View style={{ flex: 1 }}>
        <Pressable testID={`${testID}-backdrop`} accessible={false} onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View testID={`${testID}-callout`} accessibilityViewIsModal onAccessibilityEscape={close}
          style={{ position: 'absolute', top, left, width: popWidth, maxHeight: Math.max(100, height - top - spacing.md),
            backgroundColor: colors.overlay, borderColor: colors.divider, borderWidth: 1, borderRadius: radii.card,
            shadowColor: colors.foreground, shadowOpacity: 0.18, shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
          <View accessible={false} style={{ position: 'absolute', top: -7,
            left: Math.max(18, Math.min(popWidth - 24, anchor.x + anchor.width / 2 - left - 6)),
            width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: colors.overlay,
            borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.divider }} />
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}>
            <View ref={titleRef} accessible focusable accessibilityLabel={title}>
              <AppText variant="label" tone="muted">{title}</AppText>
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}
