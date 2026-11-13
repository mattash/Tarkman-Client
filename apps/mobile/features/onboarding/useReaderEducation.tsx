import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Pressable, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { useTheme } from '../../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useOnboarding } from './OnboardingProvider'
import { CoachmarkOverlay } from './CoachmarkOverlay'
import { STEPS, tipEligible, type Feature, type Step } from './state'

export function useReaderEducation({ id, healthy, ready, sheetOpen, available, following, root, targets, layoutVersion, open }: {
  id: number; healthy: boolean; ready: boolean; sheetOpen: boolean; available: boolean; following: boolean
  root: RefObject<React.ComponentRef<typeof View> | null>; targets: Record<Step, RefObject<React.ComponentRef<typeof View> | null>>; layoutVersion: string
  open(step: Exclude<Step, 'follow'>): void
}) {
  const onboarding = useOnboarding(), { t } = useI18n(), { colors } = useTheme()
  const { record, update, clearPending } = onboarding
  const [tour, setTour] = useState<Step | null>(null), [invitation, setInvitation] = useState(false)
  const [hint, setHint] = useState(false), [waitingSheet, setWaitingSheet] = useState(false)
  const [focused, setFocused] = useState(true)
  const browse = useRef(false), gesture = useRef(false), alive = useRef(true)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (settleTimer.current) clearTimeout(settleTimer.current) } }, [])
  useFocusEffect(useCallback(() => {
    setFocused(true)
    return () => { setFocused(false); setTour(null); setHint(false); setInvitation(false); browse.current = false; clearPending() }
  }, [clearPending]))
  const eligible = healthy && ready && onboarding.ready && onboarding.foreground && focused
  useEffect(() => {
    // Synchronize local presentation with externally owned live/lifecycle eligibility.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!eligible) { setTour(null); setHint(false); setInvitation(false); browse.current = false }
  }, [eligible])
  const start = useCallback((restart = false) => {
    if (!eligible) return
    const step = restart ? 'follow' : record.status === 'inProgress' ? record.checkpoint : 'follow'
    update({ status: 'inProgress', checkpoint: step, invitationPresented: true })
    setInvitation(false); setHint(false); setTour(step)
  }, [eligible, record.status, record.checkpoint, update])
  useEffect(() => {
    if (onboarding.pending?.sessionId !== id || !eligible || sheetOpen) return
    // Explicit intent is consumed after the destination reader and native presentation are ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start(onboarding.pending.restart); clearPending()
  }, [onboarding.pending, id, eligible, sheetOpen, start, clearPending])
  useEffect(() => {
    if (!eligible || sheetOpen || onboarding.pending || !onboarding.automatic || record.invitationPresented || record.suppressed || record.status !== 'notStarted') return
    // Record presentation only after hydration and initial native layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    update({ invitationPresented: true }); setInvitation(true)
  }, [eligible, sheetOpen, onboarding.pending, onboarding.automatic, record.invitationPresented, record.suppressed, record.status, update])
  useEffect(() => {
    if (tour === 'explanation' && eligible && !sheetOpen && !waitingSheet && !record.explanationTaught) update({ explanationTaught: true })
  }, [tour, eligible, sheetOpen, waitingSheet, record.explanationTaught, update])
  const end = () => { update({ status: 'skipped', suppressed: true }); setTour(null); setInvitation(false); setHint(false) }
  const recordUse = (feature: Feature) => {
    update(current => ({ used: [...new Set([...current.used, feature])] }))
    if (feature === 'return') { setHint(false); browse.current = false }
  }
  const openControl = (step: Exclude<Step, 'follow'>) => {
    if (tour) setWaitingSheet(true)
    if (step !== 'language') recordUse(step)
    setHint(false)
    open(step)
  }
  const move = (direction: number) => {
    if (!tour) return
    const index = STEPS.indexOf(tour) + direction
    if (index === STEPS.length) { update({ status: 'completed', cardDismissed: true, explanationTaught: true }); setTour(null); return }
    const step = STEPS[Math.max(0, index)]
    update({ checkpoint: step }); setTour(step)
  }
  const settle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      if (gesture.current) return
      if (!alive.current || !browse.current || !eligible || following || sheetOpen || tour || invitation || !onboarding.automatic) return
      if (tipEligible(record, 'return', onboarding.sessionUsed) && onboarding.claimTip('return')) { setHint(true); browse.current = false }
    }, 350)
  }
  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (browse.current && eligible && !following && !sheetOpen && !tour && !invitation) settle()
    return () => { if (settleTimer.current) clearTimeout(settleTimer.current) }
    // The eligibility snapshot must replace any timer created by an earlier render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, following, sheetOpen, tour, invitation, record, onboarding.sessionUsed])
  const dismissHint = () => { setHint(false); update(current => ({ dismissed: [...new Set([...current.dismissed, 'return' as const])] })) }
  const overlay = tour && eligible && !sheetOpen && !waitingSheet ? <CoachmarkOverlay key={tour} step={tour} target={targets[tour]} container={root}
    layoutVersion={layoutVersion} available={available} next={() => move(1)} back={() => move(-1)} end={end}
    tryAction={tour === 'follow' || tour === 'explanation' && !available ? undefined : () => openControl(tour as Exclude<Step, 'follow'>)} /> : null
  const invitationView = invitation && eligible && !sheetOpen && !tour ? <View style={{ padding: spacing.sm, gap: spacing.xs }}>
    <AppText variant="label">{t('onboarding.invitation')}</AppText>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <AppButton variant="quiet" onPress={() => start()}>{t('onboarding.start')}</AppButton>
      <AppButton variant="quiet" onPress={end}>{t('onboarding.notNow')}</AppButton>
    </View>
  </View> : null
  const hintView = hint && eligible && !following && !sheetOpen && !tour ? <View style={{
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, paddingLeft: spacing.md,
    borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
  }}>
    <View accessible={false} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
      <AppIcon name="next" size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1, gap: 1 }}>
      <AppText variant="label">{t('onboarding.returnTitle')}</AppText>
      <AppText variant="caption" tone="muted">{t('onboarding.returnBody')}</AppText>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.dismiss')} onPress={dismissHint}
      style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm }}>
      <AppIcon name="close" size={18} color={colors.muted} />
    </Pressable>
  </View> : null
  return { tourActive: tour !== null, endTour: () => { if (tour) end() }, overlay, invitationView, hintView, openControl, recordUse,
    browseStarted: (dragging = false) => { gesture.current = dragging; if (eligible && !tour && !sheetOpen) browse.current = true; settle() },
    browseMoved: settle,
    browseMomentum: () => { gesture.current = true },
    browseSettled: () => { gesture.current = false; settle() },
    sheetDismissed: () => { setWaitingSheet(false) },
    replay: () => { onboarding.request(false, id) },
    restart: () => { onboarding.request(true, id) },
    inProgress: record.status === 'inProgress',
  }
}
