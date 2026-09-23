import { useEffect, useRef, useState, type RefObject } from 'react'
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, View, useWindowDimensions } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../../design/tokens'
import { useI18n } from '../i18n'
import { STEPS, type Step } from './state'

type Rect = { x: number; y: number; width: number; height: number }
export function CoachmarkOverlay({ step, target, container, layoutVersion, available, next, back, end, tryAction }: {
  step: Step; target: RefObject<View | null>; container: RefObject<View | null>; layoutVersion: string
  available: boolean; next(): void; back(): void; end(): void; tryAction?(): void
}) {
  const { t } = useI18n(), { colors } = useTheme()
  const { width, height, fontScale } = useWindowDimensions()
  const [rect, setRect] = useState<Rect | null>(null)
  const [boxHeight, setBoxHeight] = useState(0), [screenReader, setScreenReader] = useState(false)
  const [linear, setLinear] = useState(false)
  const [bounds, setBounds] = useState({ width, height })
  const [measured, setMeasured] = useState(false)
  const heading = useRef<View>(null)
  const [closing, setClosing] = useState(false), after = useRef<(() => void) | null>(null)
  useEffect(() => {
    // react-native-web reports true unconditionally; web offers the same linear guide explicitly.
    if (Platform.OS === 'web') return
    let active = true
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (active) setScreenReader(value) })
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader)
    return () => { active = false; sub.remove() }
  }, [])
  useEffect(() => {
    let active = true
    const frame = requestAnimationFrame(() => {
      const anchor = target.current, root = container.current
      if (!anchor || !root) { setRect(null); setMeasured(true); return }
      root.measureInWindow((rx, ry, rw, rh) => {
        if (active) setBounds({ width: rw, height: rh })
        anchor.measureInWindow((x, y, w, h) => {
        if (active) { setRect(w > 0 && h > 0 ? { x: x - rx, y: y - ry, width: w, height: h } : null); setMeasured(true) }
      }) })
    })
    // A removed native view may never invoke its measurement callback. Defer to the linear guide.
    const timeout = setTimeout(() => { if (active) setMeasured(true) }, 500)
    return () => { active = false; cancelAnimationFrame(frame); clearTimeout(timeout) }
  }, [target, container, step, width, height, fontScale, layoutVersion])
  const fallback = measured && (!rect || screenReader || linear || fontScale > 1.5 || boxHeight > bounds.height - (rect?.y ?? 0) - (rect?.height ?? 0) - spacing.xl)
  useEffect(() => {
    if (!measured || fallback) return
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') heading.current?.focus()
      else { const node = findNodeHandle(heading.current); if (node) AccessibilityInfo.setAccessibilityFocus(node) }
    })
    return () => cancelAnimationFrame(frame)
  }, [step, measured, fallback])
  const restoreTarget = () => {
    if (Platform.OS === 'web') target.current?.focus()
    else { const node = findNodeHandle(target.current); if (node) AccessibilityInfo.setAccessibilityFocus(node) }
  }
  const finish = () => { restoreTarget(); end() }
  const advance = () => { if (step === 'preferences') restoreTarget(); next() }
  const invoke = (action: () => void) => {
    if (fallback) { after.current = action; setClosing(true) } else action()
  }
  const fallbackContent = <>
    <View ref={heading} accessible accessibilityRole="header" {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}>
      <AppText variant="caption">{t('onboarding.progress', { step: STEPS.indexOf(step) + 1 })}</AppText>
      <AppText variant="heading" maxFontSizeMultiplier={0} accessibilityRole="text">{t(titles[step])}</AppText>
    </View>
    <AppText>{t(step === 'explanation' && !available ? 'onboarding.explanationFallback' : bodies[step])}</AppText>
    {!fallback && <AppButton variant="quiet" onPress={() => setLinear(true)}>{t('onboarding.linear')}</AppButton>}
    {tryAction && <AppButton variant="secondary" onPress={() => invoke(tryAction)}>{t(step === 'language' ? 'onboarding.openLanguage' : step === 'explanation' ? 'onboarding.openExplanation' : 'onboarding.openPreferences')}</AppButton>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {step !== 'follow' && <AppButton variant="quiet" onPress={() => invoke(back)}>{t('onboarding.back')}</AppButton>}
      <AppButton onPress={() => invoke(advance)}>{t(step === 'preferences' ? 'onboarding.finish' : 'onboarding.next')}</AppButton>
      <AppButton variant="quiet" onPress={() => invoke(finish)}>{t('onboarding.end')}</AppButton>
    </View>
  </>
  if (fallback) return <AppModal visible={!closing} title={t('onboarding.tour')} onDismiss={() => invoke(finish)} openerRef={target}
    onAfterDismiss={() => { const action = after.current; after.current = null; action?.() }}>{fallbackContent}</AppModal>
  const stepIndex = STEPS.indexOf(step)
  const actionLabel = t(step === 'language' ? 'onboarding.openLanguage' : step === 'explanation' ? 'onboarding.openExplanation' : 'onboarding.openPreferences')
  const cardWidth = Math.min(520, bounds.width - spacing.md * 2)
  const pointerLeft = rect ? Math.max(spacing.lg, Math.min(cardWidth - spacing.lg, rect.x + rect.width / 2 - (bounds.width - cardWidth) / 2)) : spacing.lg
  const spotlight = rect && { x: Math.max(0, rect.x - spacing.xs), y: Math.max(0, rect.y - spacing.xs),
    right: Math.min(bounds.width, rect.x + rect.width + spacing.xs), bottom: Math.min(bounds.height, rect.y + rect.height + spacing.xs) }
  return <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0 }}>
    {spotlight && <>
      <View testID="coachmark-scrim-top" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: spotlight.y, backgroundColor: colors.backdrop }} />
      <View style={{ position: 'absolute', left: 0, top: spotlight.y, width: spotlight.x, height: spotlight.bottom - spotlight.y, backgroundColor: colors.backdrop }} />
      <View style={{ position: 'absolute', left: spotlight.right, right: 0, top: spotlight.y, height: spotlight.bottom - spotlight.y, backgroundColor: colors.backdrop }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: spotlight.bottom, bottom: 0, backgroundColor: colors.backdrop }} />
    </>}
    {rect && <View pointerEvents="none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height,
      borderWidth: 2, borderColor: colors.primary, borderRadius: radii.control }} />}
    <View testID="reader-coachmark" onAccessibilityEscape={finish}
      {...(Platform.OS === 'web' ? { onKeyDown: (event: { key: string }) => { if (event.key === 'Escape') finish() } } : {})}
      onLayout={event => setBoxHeight(event.nativeEvent.layout.height)}
      style={{ position: 'absolute', top: rect ? rect.y + rect.height + spacing.sm : 0, left: spacing.md, right: spacing.md,
        maxWidth: cardWidth, alignSelf: 'center', padding: spacing.md, gap: spacing.sm, borderRadius: radii.card, borderWidth: 1,
        borderColor: colors.divider, backgroundColor: colors.overlay, opacity: measured && rect ? 1 : 0 }}>
      {rect && <View pointerEvents="none" style={{ position: 'absolute', top: -8, left: pointerLeft - 7, width: 14, height: 14,
        transform: [{ rotate: '45deg' }], backgroundColor: colors.overlay, borderLeftWidth: 1, borderTopWidth: 1, borderColor: colors.divider }} />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View ref={heading} accessible accessibilityRole="header" {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View accessible={false} style={{ flexDirection: 'row', gap: spacing.xs }}>
              {STEPS.map((item, index) => <View key={item} style={{ width: 6, height: 6, borderRadius: 3,
                backgroundColor: index <= stepIndex ? colors.primary : colors.divider }} />)}
            </View>
            <AppText variant="caption" tone="muted">{t('onboarding.progress', { step: stepIndex + 1 })}</AppText>
          </View>
          <AppText variant="heading" maxFontSizeMultiplier={0} accessibilityRole="text">{t(titles[step])}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.end')} onPress={finish}
          style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.sm, marginRight: -spacing.sm }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pressedSubtle }}>
            <AppIcon name="close" size={18} color={colors.muted} />
          </View>
        </Pressable>
      </View>
      <AppText>{t(step === 'explanation' && !available ? 'onboarding.explanationFallback' : bodies[step])}
        {tryAction && <> <AppText accessibilityRole="link" onPress={() => invoke(tryAction)} style={{ color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' }}>{actionLabel}</AppText></>}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs }}>
        {step !== 'follow' ? <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.back')} onPress={() => invoke(back)}
          style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radii.control }}>
          <AppIcon name="back" color={colors.muted} />
        </Pressable> : <View style={{ width: touchTarget }} />}
        <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.linear')} onPress={() => setLinear(true)}
          style={{ minHeight: touchTarget, justifyContent: 'center', flexShrink: 1 }}>
          <AppText tone="muted" style={{ fontSize: 13, lineHeight: 20, textAlign: 'center', textDecorationLine: 'underline' }}>{t('onboarding.linear')}</AppText>
        </Pressable>
        <AppButton onPress={() => invoke(advance)}>{t(step === 'preferences' ? 'onboarding.finish' : 'onboarding.next')}</AppButton>
      </View>
    </View>
  </View>
}

const titles = { open: 'onboarding.openTitle', follow: 'onboarding.followTitle', language: 'onboarding.languageTitle', explanation: 'onboarding.explanationTitle', return: 'onboarding.returnTitle', preferences: 'onboarding.preferencesTitle' } as const
const bodies = { open: 'onboarding.openBody', follow: 'onboarding.followBody', language: 'onboarding.languageBody', explanation: 'onboarding.explanationBody', return: 'onboarding.returnBody', preferences: 'onboarding.preferencesBody' } as const
