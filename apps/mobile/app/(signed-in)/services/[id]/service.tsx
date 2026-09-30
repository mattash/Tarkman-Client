import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { KnownSessionStatus, Language } from '@tarkman/core'
import { AppButton } from '../../../../components/AppButton'
import { BackButton } from '../../../../components/BackButton'
import { AppIcon } from '../../../../components/AppIcon'
import { AppText } from '../../../../components/AppText'
import { Notice } from '../../../../components/Notice'
import { capitalized } from '../../../../components/PartHeading'
import { TextField } from '../../../../components/TextField'
import { useTheme } from '../../../../design/ThemeProvider'
import { useSheetBackground } from '../../../../design/liquidGlass'
import { spacing, touchTarget } from '../../../../design/tokens'
import type { LivePart } from '../../../../features/live/contracts'
import { resolveControlLanguages, usePreferences } from '../../../../features/preferences/PreferencesProvider'
import { ControlButton } from '../../../../features/services/ControlButton'
import { OpeningLine } from '../../../../features/services/OpeningLine'
import { STOP_ANNOUNCEMENT, STOP_SESSION_QR, useServiceControl } from '../../../../features/services/ServiceControlProvider'
import { statusName, useI18n } from '../../../../features/i18n'
import { ControllerStatusRow } from '../../../../features/services/presence/ControllerPresenceIndicator'

// KnownSessionStatus is one enum answering two questions, so the sheet groups them apart.
const DOING: KnownSessionStatus[] = ['active', 'paused']
const INSTEAD: KnownSessionStatus[] = ['showing_gospel', 'showing_epistle', 'showing_welcome']

/** Everything occasional: status, pause, announcement and jumping to a part. Next and Back are never here. */
export default function ServiceSheet() {
  const { sessionId, presence, state, controls, commands, part, offline, announcing, expected, run, holds, errorMessage, setSheetOpen, invalid } = useServiceControl()
  // A session deleted while this sheet is open: close it, so the control screen's unavailable notice shows.
  useEffect(() => {
    if (!invalid) return
    if (router.canGoBack()) router.back()
    else router.replace(`/services/${sessionId}`)
  }, [invalid, sessionId])
  const { colors } = useTheme()
  const sheetBackground = useSheetBackground()
  const { t } = useI18n()
  const { preferences } = usePreferences()
  // Previews come from the operator's first control language, the one they read from.
  const controlLanguages = resolveControlLanguages(preferences)
  const insets = useSafeAreaInsets()
  const [page, setPage] = useState<'service' | 'parts'>('service')
  const [message, setMessage] = useState('')
  const closed = useRef(false)
  const status = state.session?.status

  useEffect(() => {
    closed.current = false
    setSheetOpen(true)
    // Swiped away before a command returned: its success must not pop the control screen instead.
    return () => { closed.current = true; setSheetOpen(false) }
  }, [setSheetOpen])
  const close = () => {
    if (closed.current) return
    closed.current = true
    router.back()
  }
  // Permission can be revoked mid-service; the sheet goes with the rest of the controls.
  const forbidden = controls.forbidden
  useEffect(() => { if (forbidden) close() })

  const failureUnder = (names: readonly string[]) => controls.error && controls.failed && names.includes(controls.failed) && controls.failure !== 'offline'
    ? <Notice tone="danger" accessibilityRole="alert">{errorMessage!}</Notice> : null
  const setStatus = async (next: KnownSessionStatus) => {
    // You tapped, the projector changed, the sheet has no further business.
    if (await run(next, () => commands.setStatus(sessionId, next))) close()
  }
  const stopShowing = () => { void run(STOP_ANNOUNCEMENT, () => commands.setStatus(sessionId, 'active')) }

  // The pinned title row stays opaque so scrolled content never prints over it; the body lets the system glass show.
  // The scroll view is the sheet's root: on iOS the native form sheet sizes its scroll view to the whole sheet, so a title row
  // beside it is drawn over. The title row is the first, pinned child instead.
  return <ScrollView testID="service-sheet" style={{ flex: 1, backgroundColor: sheetBackground }} stickyHeaderIndices={[0]}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
    <View style={{ backgroundColor: colors.overlay }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm,
        paddingLeft: spacing.lg, paddingRight: spacing.lg + touchTarget, backgroundColor: colors.overlay }}>
        {page === 'parts' && <View style={{ marginLeft: -spacing.sm }}>
          <BackButton iconOnly accessibilityLabel={t('serviceSheet.backToService')} onPress={() => setPage('service')}>{t('common.service')}</BackButton>
        </View>}
        <AppText variant="heading" style={{ flex: 1 }}>{page === 'parts' ? t('serviceSheet.goToAnother') : t('common.service')}</AppText>
      </View>
      {/* In an unpadded wrapper, so the corner is the sheet's corner: inside the padded row it anchors to the padded edge. */}
      <View style={{ position: 'absolute', top: spacing.md, right: spacing.md }}>
        <AppButton variant="quiet" icon="close" iconOnly accessibilityLabel={t('common.closeTitle', { title: page === 'parts' ? t('serviceSheet.goToAnother') : t('common.service') })} onPress={close}>{t('common.done')}</AppButton>
      </View>
    </View>
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      {offline && <Notice tone="neutral">{t('control.offline')}</Notice>}
      {page === 'parts' ? state.parts.map(item => <PartRow key={item.key} item={item} current={item.key === part?.key} language={controlLanguages[0]} selected={controlLanguages}
        failure={failureUnder([item.key])} {...holds(item.key)}
        onPress={async () => { if (await run(item.key, () => commands.goToPart(sessionId, item.id, expected, item.liturgyPartId))) close() }} />) : <>
        <ControllerStatusRow state={presence} />
        <SheetSection label={t('serviceSheet.congregationSees')}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {DOING.map(item => <StatusButton key={item} status={item} height={52} selected={status === item} {...holds(item)} onPress={() => { void setStatus(item) }} />)}
          </View>
          {failureUnder(DOING)}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {INSTEAD.map(item => <StatusButton key={item} status={item} height={48} selected={status === item} {...holds(item)} onPress={() => { void setStatus(item) }} />)}
          </View>
          {failureUnder(INSTEAD)}
          {status === 'showing_session_qr' ? <ControlButton testID="stop-session-qr" label={t('serviceSheet.stopShowing')} height={48}
            {...holds(STOP_SESSION_QR)} onPress={() => { void run(STOP_SESSION_QR, () => commands.setStatus(sessionId, 'active')) }} />
            : <ControlButton testID="show-session-qr" label={t('serviceSheet.showReadAlongQr')} height={48}
              {...holds('showing_session_qr')} onPress={() => { void setStatus('showing_session_qr') }} />}
          {failureUnder(['showing_session_qr', STOP_SESSION_QR])}
        </SheetSection>
        <SheetSection label={t('serviceSheet.announcement')} divided>
          {announcing ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
            <AppText style={{ flex: 1, minWidth: 160 }}>{state.session?.message ?? ''}</AppText>
            <ControlButton label={t('serviceSheet.stopShowing')} height={48} labelVariant="label" {...holds(STOP_ANNOUNCEMENT)} onPress={stopShowing} />
          </View> : <>
            <TextField label={t('serviceSheet.message')} placeholder={t('serviceSheet.messagePlaceholder')} value={message} onChangeText={setMessage}
              editable={!offline} multiline returnKeyType="done" />
            <ControlButton variant="primary" label={t('serviceSheet.showThis')} height={52} unavailable={message.trim().length === 0} {...holds('showing_custom')}
              onPress={async () => {
                // Closes on send, not on keystroke.
                if (await run('showing_custom', () => commands.setStatus(sessionId, 'showing_custom', message.trim()))) close()
              }} />
          </>}
          {failureUnder(['showing_custom', STOP_ANNOUNCEMENT])}
        </SheetSection>
        <Pressable accessibilityRole="button" accessibilityHint={t('serviceSheet.partsHint')} onPress={() => setPage('parts')}
          style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm, marginTop: spacing.md }}>
          <AppText variant="rowTitle" style={{ flex: 1 }}>{t('serviceSheet.goToAnother')}</AppText>
          <AppIcon name="next" color={colors.muted} />
        </Pressable>
      </>}
    </View>
  </ScrollView>
}

function SheetSection({ label, divided = false, children }: { label: string; divided?: boolean; children: ReactNode }) {
  const { colors } = useTheme()
  return <View style={{ gap: spacing.sm, ...(divided ? { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.lg, marginTop: spacing.md } : {}) }}>
    <AppText variant="eyebrow" tone="muted">{label}</AppText>
    {children}
  </View>
}

function StatusButton({ status, height, selected, sending, held, onPress }: { status: KnownSessionStatus; height: number; selected: boolean; sending: boolean; held: boolean; onPress(): void }) {
  return <ControlButton label={statusName(status)} height={height} flex={height === 52 ? 1 : undefined} labelVariant="label"
    selected={selected} sending={sending} held={held} onPress={onPress} />
}

function PartRow({ item, current, language, selected, failure, sending, held, onPress }: {
  item: LivePart; current: boolean; language: Language; selected: readonly Language[]; failure: ReactNode; sending: boolean; held: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  const { t } = useI18n()
  return <View style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
        <AppText variant="label" tone={current ? 'accent' : 'default'}>{t(current ? 'serviceSheet.currentPartRow' : 'serviceSheet.partRow', { position: item.position, role: capitalized(item.role) })}</AppText>
        <OpeningLine part={item} language={language} selected={selected} numberOfLines={2} />
      </View>
      <ControlButton label={t('serviceSheet.goHere')} accessibilityLabel={t('serviceSheet.goToPartLabel', { position: item.position })} height={48} labelVariant="label"
        sending={sending} held={held} unavailable={current} onPress={onPress} />
    </View>
    {failure}
  </View>
}
