import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation'
import type { DisplayLinkFields } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { TextField } from '../../components/TextField'
import { Card } from '../../components/Surface'
import { spacing } from '../../design/tokens'
import { useI18n, type MessageKey } from '../i18n'
import { DEVICE_TYPES, TEXT_MOVEMENTS, LANGUAGE_SYNCS } from './customization'
import { DISPLAY_MODES, DISPLAY_STATUS_VIEWS } from './config'
import { CREATE_DEFAULTS, changedFields, localExpiration, parseExpiration } from './draft'
import { DisplayPresentation } from './DisplayProjection'
import { previewState } from './DisplayPreview'
import { LinkActions } from './LinkActions'
import { editableFields } from './managementApi'
import type { ManagerController, ManagerSnapshot } from './ManagerRoute'

export function LinkEditor({ state, controller }: { state: ManagerSnapshot; controller: ManagerController }) {
  const { t } = useI18n(), navigation = useNavigation()
  const { draft, baseline } = state
  const [advanced, setAdvanced] = useState(false), [long, setLong] = useState(false)
  const [expirationInput, setExpirationInput] = useState<{ baseline: typeof baseline; value: string }>()
  const expiration = expirationInput && expirationInput.baseline === baseline ? expirationInput.value : localExpiration(draft.expires_at)
  const [reviewSelection, setReviewSelection] = useState<{ conflict: typeof state.conflict; fields: (keyof DisplayLinkFields)[] }>()
  const selected = reviewSelection?.conflict === state.conflict ? reviewSelection?.fields ?? [] : []
  const [pending, setPending] = useState<NavigationAction | null>(null), [discard, setDiscard] = useState(false)
  const cancelRef = useRef<View>(null)
  const changes = changedFields(baseline ?? CREATE_DEFAULTS, draft), dirty = Object.keys(changes).length > 0
  const guarded = dirty || state.saving || state.uncertain
  const disabled = state.loading || state.saving || state.unavailable || !state.loaded
  const sample = useMemo(() => previewState(long), [long])
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
  function choice<K extends keyof DisplayLinkFields>(field: K, values: readonly NonNullable<DisplayLinkFields[K]>[]) {
    return <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{t(`links.${field}`)}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {values.map(value => <AppButton key={String(value)} variant="secondary" selected={draft[field] === value} disabled={disabled}
          accessibilityLabel={t('links.choiceLabel', { field: t(`links.${field}`), value: optionLabel(value) })}
          onPress={() => controller.edit({ [field]: value, ...(field === 'mode' ? { lang2: value === 'single' ? null : draft.lang2 ?? 'en' } : {}) })}>
          {optionLabel(value)}
        </AppButton>)}
      </View>
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
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
        <AppButton ref={cancelRef} variant="quiet" onPress={leave}>{t('common.cancel')}</AppButton>
        <AppText variant="title" accessibilityRole="header">{t(baseline ? 'links.edit' : 'links.create')}</AppText>
        <AppText>{t('links.saveHelp')}</AppText>
        {guarded && <AppText accessibilityLiveRegion="polite">{t('links.unsaved')}</AppText>}
        {state.loading && <ActivityIndicator accessibilityLabel={t('links.loading')} />}
        {state.error && <Card><AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" tone="destructive">{state.error}</AppText>
          {editableFields.filter(field => state.fields[field]).map(field => <AppText key={field} accessibilityRole="alert">{t(`links.${field}`)}: {state.fields[field]}</AppText>)}
          {!state.loaded && <AppButton onPress={controller.refresh}>{t('common.retry')}</AppButton>}
        </Card>}
        {state.unavailable ? <AppButton onPress={leave}>{t('links.backToList')}</AppButton> : <>
          <Card>
            <AppText variant="heading">{t('links.basics')}</AppText>
            <TextField label={t('links.titleField')} value={draft.title} onChangeText={title => controller.edit({ title })} editable={!disabled} error={state.fields.title} returnKeyType="done" />
            <AppText tone="muted">{t('links.titleHelp')}</AppText>
            {choice('device_type', DEVICE_TYPES)}
            <AppText tone="muted">{t('links.deviceHelp')}</AppText>
            {choice('mode', DISPLAY_MODES)}
            {choice('lang1', ['translit', 'en', 'grabar'])}
            {draft.mode === 'parallel' && choice('lang2', ['translit', 'en', 'grabar'])}
            {(draft.lang1 === 'hyw' || draft.lang2 === 'hyw') && <AppText accessibilityRole="alert">{t('links.unsupported')}</AppText>}
            <AppText variant="label">{t('links.fontValue', { value: draft.font_scale })}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <AppButton variant="secondary" disabled={disabled || draft.font_scale <= 50} onPress={() => controller.edit({ font_scale: Math.max(50, draft.font_scale - 5) })}>{t('links.smaller')}</AppButton>
              <AppButton variant="secondary" disabled={disabled || draft.font_scale >= 200} onPress={() => controller.edit({ font_scale: Math.min(200, draft.font_scale + 5) })}>{t('links.larger')}</AppButton>
            </View>
          </Card>
          <Card><AppText variant="heading">{t('links.options')}</AppText>
            {choice('status_view', DISPLAY_STATUS_VIEWS)}
            <AppText tone="muted">{t('links.statusHelp')}</AppText>
            {toggle('show_notifications')}{toggle('show_explanations')}
            <AppText tone="muted">{t('links.explanationHelp')}</AppText>
          </Card>
          <AppButton variant="secondary" accessibilityState={{ expanded: advanced }} onPress={() => setAdvanced(!advanced)}>{t('links.advanced')}</AppButton>
          {advanced && <Card>
            {choice('text_movement', TEXT_MOVEMENTS)}<AppText tone="muted">{t('links.movementHelp')}</AppText>
            {draft.mode === 'parallel' && choice('language_sync', LANGUAGE_SYNCS)}
            <AppText variant="label">{t('links.marginValue', { value: draft.margin_percent === null ? t('links.auto') : draft.margin_percent })}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <AppButton variant="secondary" selected={draft.margin_percent === null} disabled={disabled} onPress={() => controller.edit({ margin_percent: null })}>{t('links.auto')}</AppButton>
              <AppButton variant="secondary" disabled={disabled || draft.margin_percent === 0} onPress={() => controller.edit({ margin_percent: Math.max(0, (draft.margin_percent ?? 1) - 1) })}>{t('links.lessMargin')}</AppButton>
              <AppButton variant="secondary" disabled={disabled || draft.margin_percent === 15} onPress={() => controller.edit({ margin_percent: Math.min(15, (draft.margin_percent ?? -1) + 1) })}>{t('links.moreMargin')}</AppButton>
            </View>
            <TextField label={t('links.expires_at')} value={expiration} editable={!disabled} autoCapitalize="none" autoCorrect={false} placeholder={t('links.expiryFormat')}
              error={state.fields.expires_at} onChangeText={value => { setExpirationInput({ baseline, value }); controller.edit({ expires_at: parseExpiration(value) }) }} />
            <AppText tone="muted">{t('links.expiryHelp', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</AppText>
          </Card>}
          <Card><AppText variant="heading">{t('links.preview')}</AppText><AppText tone="muted">{t('links.previewHelp')}</AppText>
            <AppButton variant="quiet" selected={long} onPress={() => setLong(!long)}>{t('links.longSample')}</AppButton>
            <View style={{ height: 420, overflow: 'hidden' }}><DisplayPresentation state={sample} sessionId={1} config={draft} preview /></View>
          </Card>
          {state.conflict && <Card>
            <AppText variant="heading" accessibilityRole="alert">{t('links.conflict')}</AppText><AppText>{t('links.reviewHelp')}</AppText>
            {editableFields.map(field => <View key={field} style={{ gap: spacing.xs }}>
              <AppText variant="label">{t(`links.${field}`)}</AppText>
              <AppText>{t('links.currentValue', { value: fieldValue(field, state.conflict![field]) })}</AppText>
              {draft[field] !== state.conflict![field] && <>
                <AppText>{t('links.draftValue', { value: fieldValue(field, draft[field]) })}</AppText>
                <AppButton variant="secondary" selected={selected.includes(field)} onPress={() => setReviewSelection({ conflict: state.conflict, fields: selected.includes(field) ? selected.filter(key => key !== field) : [...selected, field] })}>{t('links.keepChange')}</AppButton>
              </>}
            </View>)}
            <AppButton onPress={() => controller.review(selected)}>{t('links.applyReview')}</AppButton>
          </Card>}
          {state.uncertain && <Card><AppText accessibilityRole="alert">{t('links.uncertain')}</AppText>
            <AppButton loading={state.loading} onPress={controller.reconcile}>{t('links.reconcile')}</AppButton>
            {state.reconciled && !baseline && <><AppText>{t('links.creationReview')}</AppText>
              {state.links.map(link => <AppText key={link.token}>{link.title} · {new Date(link.created_at).toLocaleString()}</AppText>)}
              <AppButton onPress={leave}>{t('links.backToList')}</AppButton></>}
          </Card>}
          <AppButton loading={state.saving} disabled={disabled || !!state.conflict || state.uncertain || (!!baseline && !dirty)} onPress={controller.save}>{t(baseline ? 'links.save' : 'links.create')}</AppButton>
          {state.saved && <AppText accessibilityLiveRegion="polite">{t('links.saved')}</AppText>}
          {baseline && <><LinkActions link={baseline} disabled={dirty || state.saving || state.uncertain || !!state.conflict} /><AppText tone="muted">{t('links.privacy')}</AppText></>}
        </>}
      </View>
    </ScrollView>
    <AppModal visible={!!pending && !discard} onDismiss={() => setPending(null)} title={t('links.unsaved')} openerRef={cancelRef}>
      <AppText>{t('links.discardHelp')}</AppText>
      <AppButton variant="destructive" onPress={() => setDiscard(true)}>{t('links.discard')}</AppButton>
      <AppButton variant="secondary" onPress={() => setPending(null)}>{t('links.keepEditing')}</AppButton>
    </AppModal>
  </KeyboardAvoidingView>
}
