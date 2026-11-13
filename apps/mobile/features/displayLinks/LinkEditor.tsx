import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation'
import type { DisplayLinkFields } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppIcon } from '../../components/AppIcon'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { SegmentedControl } from '../../components/SegmentedControl'
import { TextField } from '../../components/TextField'
import { Card } from '../../components/Surface'
import { spacing } from '../../design/tokens'
import { useTheme } from '../../design/ThemeProvider'
import { useI18n, type MessageKey } from '../i18n'
import { DEVICE_TYPES, TEXT_MOVEMENTS, LANGUAGE_SYNCS } from './customization'
import { DISPLAY_LANGUAGES, DISPLAY_MODES, DISPLAY_STATUS_VIEWS } from './config'
import { CREATE_DEFAULTS, changedFields, localExpiration, publicationSupported } from './draft'
import { DisplayPresentation } from './DisplayProjection'
import { PreviewStage } from './DisplayFrame'
import { previewState } from './DisplayPreview'
import { LinkActions } from './LinkActions'
import { editableFields, errorFields } from './managementApi'
import type { ManagerController, ManagerSnapshot } from './ManagerRoute'

type PickerField = 'device_type' | 'lang1' | 'lang2' | 'status_view' | 'text_movement' | 'language_sync'

export function LinkEditor({ state, controller }: { state: ManagerSnapshot; controller: ManagerController }) {
  const { t } = useI18n(), navigation = useNavigation(), { colors } = useTheme()
  const { draft, baseline } = state
  const [long, setLong] = useState(false), [step, setStep] = useState(0)
  const [picker, setPicker] = useState<{ field: PickerField; values: readonly string[] } | null>(null)
  const expiration = state.expirationInput ?? localExpiration(draft.expires_at)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const revokeRef = useRef<React.ComponentRef<typeof View>>(null)
  const [reviewSelection, setReviewSelection] = useState<{ conflict: typeof state.conflict; fields: (keyof DisplayLinkFields)[] }>()
  const selected = reviewSelection?.conflict === state.conflict ? reviewSelection?.fields ?? [] : []
  const [pending, setPending] = useState<NavigationAction | null>(null), [discard, setDiscard] = useState(false)
  const cancelRef = useRef<React.ComponentRef<typeof View>>(null)
  const changes = changedFields(baseline ?? CREATE_DEFAULTS, draft), dirty = Object.keys(changes).length > 0 || state.publish !== undefined || state.expirationInvalid
  const guarded = !state.revoked && (dirty || state.saving || state.uncertain)
  const disabled = state.loading || state.saving || state.unavailable || !state.loaded
  const sample = useMemo(() => previewState(long), [long])
  const canPublish = publicationSupported(baseline, state.links), publishedNow = state.publish ?? baseline?.published ?? false
  const stepNames = [t('links.basics'), t('links.options'), t('links.advanced')]
  usePreventRemove(guarded && !discard, ({ data }) => setPending(data.action))
  useEffect(() => { if (state.error && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(state.error) }, [state.error])
  useEffect(() => { if (discard && pending) navigation.dispatch(pending) }, [discard, pending, navigation])
  useEffect(() => {
    if (Platform.OS !== 'web' || !guarded) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guarded])
  const leave = () => router.replace('/display-links')
  function choice<K extends PickerField>(field: K, values: readonly NonNullable<DisplayLinkFields[K]>[]) {
    const label = t(`links.${field}`), value = draft[field] ? optionLabel(draft[field]) : t('links.automaticOrNone')
    return <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={t('links.choiceLabel', { field: label, value })} disabled={disabled}
        onPress={() => setPicker({ field, values: values.map(String) })}
        style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface,
          paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText style={{ flex: 1 }}>{value}</AppText><AppIcon name="next" color={colors.muted} size={18} />
      </Pressable>
      {state.fields[field] && <AppText tone="destructive" accessibilityRole="alert">{state.fields[field]}</AppText>}
    </View>
  }
  function optionLabel(value: unknown): string {
    return t(`links.${String(value)}` as MessageKey)
  }
  function toggle(field: 'show_notifications' | 'show_explanations') {
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <AppText style={{ flex: 1 }}>{t(`links.${field}`)}</AppText>
      <Switch accessibilityLabel={t(`links.${field}`)} value={draft[field]} disabled={disabled} onValueChange={value => controller.edit({ [field]: value })} />
    </View>
  }
  function fieldValue(field: keyof DisplayLinkFields, value: DisplayLinkFields[keyof DisplayLinkFields]): string {
    if (value === null) return t('links.automaticOrNone')
    if (typeof value === 'boolean') return t(value ? 'links.on' : 'links.off')
    if (field === 'expires_at') return new Date(String(value)).toLocaleString()
    if (['title', 'font_scale', 'margin_percent'].includes(field)) return String(value)
    return optionLabel(value)
  }
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.md }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md }}>
        <View style={{ alignSelf: 'flex-start' }}><AppButton ref={cancelRef} variant="text" onPress={leave}>{t('common.cancel')}</AppButton></View>
        <AppText variant="screenTitle" accessibilityRole="header">{t(baseline ? 'links.edit' : 'links.create')}</AppText>
        <AppText tone="muted">{t('links.saveHelp')}</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {stepNames.map((name, index) => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={`${index + 1}. ${name}`}
            accessibilityState={{ selected: step === index }} onPress={() => setStep(index)}
            style={{ flex: 1, minHeight: 68, alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.primary,
              backgroundColor: step === index ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="caption" style={{ color: step === index ? colors.onPrimary : colors.primary }}>{String(index + 1)}</AppText>
            </View>
            <AppText variant="caption" numberOfLines={2} style={{ color: step === index ? colors.primary : colors.muted, textAlign: 'center' }}>{name}</AppText>
          </Pressable>)}
        </View>
        {guarded && <AppText accessibilityLiveRegion="polite">{t('links.unsaved')}</AppText>}
        {state.loading && <ActivityIndicator accessibilityLabel={t('links.loading')} />}
        {state.error && <Card><AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" tone="destructive">{state.error}</AppText>
          {errorFields.filter(field => state.fields[field]).map(field => <AppText key={field} accessibilityRole="alert">{t(`links.${field}`)}: {state.fields[field]}</AppText>)}
          {!state.loaded && <AppButton onPress={controller.refresh}>{t('common.retry')}</AppButton>}
        </Card>}
        {state.revoked && <AppText accessibilityRole="alert">{t('links.revoked')}</AppText>}
        {state.unavailable ? <AppButton onPress={leave}>{t('links.backToList')}</AppButton> : <>
          {step === 0 && <Card>
            <AppText variant="heading">{t('links.basics')}</AppText>
            <TextField label={t('links.titleField')} value={draft.title} onChangeText={title => controller.edit({ title })} editable={!disabled} error={state.fields.title} returnKeyType="done" />
            <AppText tone="muted">{t('links.titleHelp')}</AppText>
            {choice('device_type', DEVICE_TYPES)}
            <AppText tone="muted">{t('links.deviceHelp')}</AppText>
            <View style={{ gap: spacing.xs }}><AppText variant="label">{t('links.mode')}</AppText>
              <SegmentedControl label={t('links.mode')} value={draft.mode} disabled={disabled}
                options={DISPLAY_MODES.map(value => ({ value, label: optionLabel(value) }))}
                onChange={value => controller.edit({ mode: value, lang2: value === 'single' ? null : draft.lang2 ?? 'en' })} />
            </View>
            {choice('lang1', DISPLAY_LANGUAGES)}
            {draft.mode === 'parallel' && choice('lang2', DISPLAY_LANGUAGES)}
            <AppText variant="label">{t('links.fontValue', { value: draft.font_scale })}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppButton variant="secondary" accessibilityLabel={t('links.smaller')} disabled={disabled || draft.font_scale <= 50} onPress={() => controller.edit({ font_scale: Math.max(50, draft.font_scale - 5) })}>−</AppButton>
              <AppText style={{ minWidth: 64, textAlign: 'center' }}>{draft.font_scale}%</AppText>
              <AppButton variant="secondary" accessibilityLabel={t('links.larger')} disabled={disabled || draft.font_scale >= 200} onPress={() => controller.edit({ font_scale: Math.min(200, draft.font_scale + 5) })}>+</AppButton>
            </View>
          </Card>}
          {step === 1 && <Card><AppText variant="heading">{t('links.options')}</AppText>
            {choice('status_view', DISPLAY_STATUS_VIEWS)}
            <AppText tone="muted">{t('links.statusHelp')}</AppText>
            {toggle('show_notifications')}{toggle('show_explanations')}
            <AppText tone="muted">{t('links.explanationHelp')}</AppText>
          </Card>}
          {step === 2 && <>
          <Card><AppText variant="heading">{t('links.advanced')}</AppText>
            {choice('text_movement', TEXT_MOVEMENTS)}<AppText tone="muted">{t('links.movementHelp')}</AppText>
            {draft.mode === 'parallel' && choice('language_sync', LANGUAGE_SYNCS)}
            <AppText variant="label">{t('links.marginValue', { value: draft.margin_percent === null ? t('links.auto') : draft.margin_percent })}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppButton variant="secondary" selected={draft.margin_percent === null} disabled={disabled} onPress={() => controller.edit({ margin_percent: null })}>{t('links.auto')}</AppButton>
              <AppButton variant="secondary" accessibilityLabel={t('links.lessMargin')} disabled={disabled || draft.margin_percent === 0} onPress={() => controller.edit({ margin_percent: Math.max(0, (draft.margin_percent ?? 1) - 1) })}>−</AppButton>
              <AppText style={{ minWidth: 36, textAlign: 'center' }}>{draft.margin_percent === null ? '—' : `${draft.margin_percent}%`}</AppText>
              <AppButton variant="secondary" accessibilityLabel={t('links.moreMargin')} disabled={disabled || draft.margin_percent === 15} onPress={() => controller.edit({ margin_percent: Math.min(15, (draft.margin_percent ?? -1) + 1) })}>+</AppButton>
            </View>
            <TextField label={t('links.expires_at')} value={expiration} editable={!disabled} autoCapitalize="none" autoCorrect={false} placeholder={t('links.expiryFormat')}
              error={state.fields.expires_at} onChangeText={controller.editExpiration} />
            <AppText tone="muted">{t('links.expiryHelp', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</AppText>
          </Card>
          {canPublish && <Card>
            <AppText variant="heading">{t('links.publicHeading')}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <AppText style={{ flex: 1 }}>{t('links.published')}</AppText>
              <Switch accessibilityLabel={t('links.published')} value={publishedNow} disabled={disabled} onValueChange={controller.setPublished} />
            </View>
            <AppText tone="muted">{t('links.publishedHelp')}</AppText>
            {state.fields.published && <AppText tone="destructive" accessibilityRole="alert">{state.fields.published}</AppText>}
          </Card>}
          <Card><AppText variant="heading">{t('links.preview')}</AppText><AppText tone="muted">{t('links.previewHelp')}</AppText>
            <AppButton variant="quiet" selected={long} onPress={() => setLong(!long)}>{t('links.longSample')}</AppButton>
            <PreviewStage height={420}>{size => <DisplayPresentation state={sample} sessionId={1} config={draft} preview size={size} />}</PreviewStage>
          </Card>
          </>}
          {state.conflict && <Card>
            <AppText variant="heading" accessibilityRole="alert">{t('links.conflict')}</AppText><AppText>{t('links.reviewHelp')}</AppText>
            {editableFields.map(field => <View key={field} style={{ gap: spacing.xs }}>
              <AppText variant="label">{t(`links.${field}`)}</AppText>
              <AppText>{t('links.currentValue', { value: fieldValue(field, state.conflict![field]) })}</AppText>
              {(draft[field] !== state.conflict![field] || field === 'expires_at' && state.expirationInput !== undefined) && <>
                <AppText>{t('links.draftValue', { value: field === 'expires_at' && state.expirationInput !== undefined ? state.expirationInput : fieldValue(field, draft[field]) })}</AppText>
                <AppButton variant="secondary" selected={selected.includes(field)} onPress={() => setReviewSelection({ conflict: state.conflict, fields: selected.includes(field) ? selected.filter(key => key !== field) : [...selected, field] })}>{t('links.keepChange')}</AppButton>
              </>}
            </View>)}
            <AppButton onPress={() => controller.review(selected)}>{t('links.applyReview')}</AppButton>
          </Card>}
          {state.uncertain && <Card><AppText accessibilityRole="alert">{t(state.revokePending ? 'links.revokeUncertain' : 'links.uncertain')}</AppText>
            <AppButton loading={state.loading} onPress={controller.reconcile}>{t('links.reconcile')}</AppButton>
            {state.reconciled && !baseline && <><AppText>{t('links.creationReview')}</AppText>
              {state.links.map(link => <AppText key={link.token}>{link.title} · {new Date(link.created_at).toLocaleString()}</AppText>)}
              <AppButton onPress={leave}>{t('links.backToList')}</AppButton></>}
          </Card>}
          <View style={{ height: spacing.md }} />
          {baseline && <AppButton ref={revokeRef} variant="destructive" disabled={disabled || state.uncertain || !!state.conflict} onPress={() => setConfirmRevoke(true)}>{t('links.revoke')}</AppButton>}
          {state.saved && <AppText accessibilityLiveRegion="polite">{t('links.saved')}</AppText>}
          {baseline && <><LinkActions link={baseline} disabled={dirty || state.saving || state.uncertain || !!state.conflict} /><AppText tone="muted">{t('links.privacy')}</AppText></>}
        </>}
      </View>
    </ScrollView>
    {!state.unavailable && !state.revoked && <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, gap: spacing.sm }}>
      <AppText variant="caption" tone="muted" numberOfLines={2}>{t('links.summary', { mode: t(`links.${draft.mode}`), device: t(`links.${draft.device_type}`), scale: draft.font_scale,
        languages: [draft.lang1, ...(draft.mode === 'parallel' && draft.lang2 ? [draft.lang2] : [])].map(language => t(`links.${language}`)).join(' / ') })}</AppText>
      {step < 2 ? <AppButton size="hero" disabled={disabled} onPress={() => setStep(current => Math.min(2, current + 1))}>{t('onboarding.next')}</AppButton>
        : <AppButton size="hero" loading={state.saving} disabled={disabled || !!state.conflict || state.uncertain || (!!baseline && !dirty)} onPress={controller.save}>{t(baseline ? 'links.save' : 'links.create')}</AppButton>}
      {baseline && <AppButton variant="text" onPress={leave}>{t('links.backToList')}</AppButton>}
    </View>}
    <AppModal visible={!!picker} onDismiss={() => setPicker(null)} title={picker ? t(`links.${picker.field}`) : ''}>
      {picker?.values.map(value => <AppButton key={value} variant="secondary" size="form" selected={draft[picker.field] === value}
        accessibilityState={{ selected: draft[picker.field] === value }} onPress={() => { controller.edit({ [picker.field]: value }); setPicker(null) }}>{optionLabel(value)}</AppButton>)}
    </AppModal>
    <AppModal visible={confirmRevoke} onDismiss={() => setConfirmRevoke(false)} title={t('links.revoke')} openerRef={revokeRef}>
      <AppText>{t('links.revokeHelp')}</AppText>
      <AppButton variant="destructive" disabled={disabled || state.uncertain || !!state.conflict} onPress={() => { setConfirmRevoke(false); void controller.revoke() }}>{t('links.confirmRevoke')}</AppButton>
      <AppButton variant="secondary" onPress={() => setConfirmRevoke(false)}>{t('common.cancel')}</AppButton>
    </AppModal>
    <AppModal visible={!!pending && !discard} onDismiss={() => setPending(null)} title={t('links.unsaved')} openerRef={cancelRef}>
      <AppText>{t('links.discardHelp')}</AppText>
      <AppButton variant="destructive" onPress={() => setDiscard(true)}>{t('links.discard')}</AppButton>
      <AppButton variant="secondary" onPress={() => setPending(null)}>{t('links.keepEditing')}</AppButton>
    </AppModal>
  </KeyboardAvoidingView>
}
