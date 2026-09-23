import { useEffect, useRef, useState, type RefObject } from 'react'
import { AccessibilityInfo, findNodeHandle, Platform, View, useWindowDimensions } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppModal } from '../../components/AppModal'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing } from '../../design/tokens'
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
  const content = <>
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
    onAfterDismiss={() => { const action = after.current; after.current = null; action?.() }}>{content}</AppModal>
  return <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0 }}>
    {rect && <View pointerEvents="none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height,
      borderWidth: 2, borderColor: colors.primary, borderRadius: radii.control }} />}
    <View testID="reader-coachmark" onAccessibilityEscape={finish}
      {...(Platform.OS === 'web' ? { onKeyDown: (event: { key: string }) => { if (event.key === 'Escape') finish() } } : {})}
      onLayout={event => setBoxHeight(event.nativeEvent.layout.height)}
      style={{ position: 'absolute', top: rect ? rect.y + rect.height + spacing.sm : 0, left: spacing.md, right: spacing.md,
        maxWidth: Math.min(520, bounds.width - spacing.md * 2), alignSelf: 'center', padding: spacing.md, gap: spacing.sm, borderRadius: radii.card, borderWidth: 1,
        borderColor: colors.divider, backgroundColor: colors.overlay, opacity: measured && rect ? 1 : 0 }}>
      {content}
    </View>
  </View>
}

const titles = { open: 'onboarding.openTitle', follow: 'onboarding.followTitle', language: 'onboarding.languageTitle', explanation: 'onboarding.explanationTitle', return: 'onboarding.returnTitle', preferences: 'onboarding.preferencesTitle' } as const
const bodies = { open: 'onboarding.openBody', follow: 'onboarding.followBody', language: 'onboarding.languageBody', explanation: 'onboarding.explanationBody', return: 'onboarding.returnBody', preferences: 'onboarding.preferencesBody' } as const
