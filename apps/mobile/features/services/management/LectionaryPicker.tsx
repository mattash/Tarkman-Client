import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, View } from 'react-native'
import type { DayResult, Language } from '@tarkman/lectionary'
import { AppButton } from '../../../components/AppButton'
import { AppIcon } from '../../../components/AppIcon'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { Notice } from '../../../components/Notice'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { useTheme } from '../../../design/ThemeProvider'
import { radii, spacing, touchTarget } from '../../../design/tokens'
import { useI18n } from '../../i18n'
import { getLectionaryDay, lectionaryCoverage, readingReferences, selectedReadings, type ReadingPatch, type ReadingSelection } from '../../lectionary'
import { sameDraft, type SessionDraft } from './draft'

interface Preview { draft: SessionDraft; language: Language; result: DayResult | null }
const emptySelection = (): ReadingSelection => ({ gospel: [], epistle: [], prophetic: [] })

/** Explicit preview/selection/application for an editable draft. Lookup never edits it. */
export function LectionaryPicker({ draft, editable, onApply }: {
  draft: SessionDraft; editable: boolean; onApply(expected: SessionDraft, patch: ReadingPatch): boolean
}) {
  const { t } = useI18n()
  const coverage = lectionaryCoverage()
  const wholeYears = coverage.from.endsWith('-01-01') && coverage.through.endsWith('-12-31')
  const range = { from: wholeYears ? coverage.from.slice(0, 4) : coverage.from, through: wholeYears ? coverage.through.slice(0, 4) : coverage.through }
  const [language, setLanguage] = useState<Language>('en')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selection, setSelection] = useState<ReadingSelection>(emptySelection)
  const [visible, setVisible] = useState(false)
  const [rejected, setRejected] = useState(false)
  const request = useRef(0)
  const opener = useRef<React.ComponentRef<typeof View>>(null)
  useEffect(() => () => { request.current++ }, [])
  const stale = rejected || !!preview && !sameDraft(preview.draft, draft)
  const day = preview?.result?.ok ? preview.result.day : null
  const liturgicalDay = day?.['Liturgical Day'] // i18n-ignore: upstream schema key
  const referenceOnly = day ? Object.entries(day.Readings).filter(([category]) => category !== 'Gospel' && category !== 'Epistle') : [] // i18n-ignore: upstream schema keys
  const patch = day ? selectedReadings(day, selection) : {}
  const hasSelection = Object.keys(patch).length > 0

  async function lookup() {
    const id = ++request.current
    const next: Preview = { draft: { ...draft, options: { ...draft.options }, liturgies: [...draft.liturgies] }, language, result: null }
    setPreview(next); setSelection(emptySelection()); setRejected(false); setVisible(true)
    try {
      const result = await getLectionaryDay(next.draft.date, language)
      if (request.current === id) setPreview({ ...next, result })
    } catch {
      if (request.current === id) setPreview({ ...next, result: { ok: false, reason: 'data-load', detail: 'load-failed' } })
    }
  }
  function dismiss() { request.current++; setVisible(false) }
  function apply() {
    if (!preview || !day || stale || !editable || !hasSelection) return
    if (onApply(preview.draft, patch)) dismiss()
    else setRejected(true)
  }

  return <View style={{ gap: spacing.sm }}>
    <AppText variant="label">{t('lectionary.title')}</AppText>
    <SegmentedControl<Language> label={t('lectionary.contentLanguage')} value={language} onChange={setLanguage} disabled={!editable}
      options={[{ value: 'en', label: t('lectionary.english') }, { value: 'hy', label: t('lectionary.armenian') }]} />
    <AppButton ref={opener} variant="secondary" disabled={!editable} onPress={() => void lookup()}>{t('lectionary.preview')}</AppButton>
    <AppText variant="caption" tone="muted">{t('lectionary.help', range)}</AppText>
    <AppModal visible={visible} onDismiss={dismiss} title={t('lectionary.title')} openerRef={opener} dismissLabel={t('common.cancel')}>
      {preview && <AppText variant="label">{preview.draft.date}</AppText>}
      {stale && <Notice tone="neutral">{t('lectionary.stale')}</Notice>}
      {!preview?.result && <ActivityIndicator accessibilityLabel={t('lectionary.loading')} />}
      {preview?.result && !preview.result.ok && <Notice tone="neutral">{t(preview.result.reason === 'invalid-date' ? 'lectionary.invalidDate'
        : preview.result.reason === 'out-of-range' ? 'lectionary.outOfRange' : 'lectionary.unavailable', range)}</Notice>}
      {day && <>
        <AppText variant="heading" language={preview?.language === 'hy' ? 'grabar' : 'en'}>{liturgicalDay}</AppText>
        <AppText variant="caption" tone="muted">{t('lectionary.source', { source: day.Source })}</AppText>
        {day.Confidence != null && <AppText variant="caption" tone="muted">{t('lectionary.confidence', { confidence: day.Confidence })}</AppText>}
        {day.Note != null && <AppText variant="caption" tone="muted">{day.Note}</AppText>}
        {day.Date.startsWith('2027-') && <Notice tone="neutral">{t('lectionary.validation2027')}</Notice>}
        <AppText tone="muted">{t('lectionary.selectionHelp')}</AppText>
        {!day.ReadingsList.length && <Notice tone="neutral">{t('lectionary.noReadings')}</Notice>}
        {(['gospel', 'epistle', 'prophetic'] as const).map(field => <View key={field} style={{ gap: spacing.xs }}>
          <AppText variant="label">{t(`sessionManagement.${field}`)}</AppText>
          {field === 'prophetic' && <AppText tone="muted">{t('lectionary.propheticHelp')}</AppText>}
          {readingReferences(day, field).map((reference, index) => <ReadingChoice key={index} text={reference}
            accessibilityLabel={field === 'prophetic' ? `${t('sessionManagement.prophetic')}: ${reference}` : reference}
            language={preview!.language} selected={selection[field].includes(index)} disabled={!editable || stale}
            onPress={() => setSelection(previous => ({ ...previous, [field]: previous[field].includes(index)
              ? previous[field].filter(value => value !== index) : [...previous[field], index] }))} />)}
          {!readingReferences(day, field).length && <AppText tone="muted">{t('lectionary.noneInCategory')}</AppText>}
        </View>)}
        {referenceOnly.map(([category, references]) => <View key={category} style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('lectionary.referenceOnly', { category: categoryLabel(category) })}</AppText>
          {references.map((reference, index) => <AppText key={index} language={preview!.language === 'hy' ? 'grabar' : 'en'}>{reference}</AppText>)}
        </View>)}
        {hasSelection && <View style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('lectionary.replaceWarning')}</AppText>
          {(['gospel', 'epistle', 'prophetic'] as const).filter(field => patch[field] !== undefined).map(field => <View key={field} style={{ gap: spacing.xs }}>
            <AppText variant="label">{t(`sessionManagement.${field}`)}</AppText>
            <AppText tone="muted">{t('lectionary.current', { value: preview!.draft.options[field] || t('lectionary.empty') })}</AppText>
            <AppText language={preview!.language === 'hy' ? 'grabar' : 'en'}>{patch[field]}</AppText>
          </View>)}
        </View>}
        <AppButton disabled={!editable || stale || !hasSelection} onPress={apply}>{t('lectionary.apply')}</AppButton>
      </>}
      <AppButton variant="secondary" disabled={!editable} onPress={() => void lookup()}>{t('lectionary.refresh')}</AppButton>
    </AppModal>
  </View>

  function categoryLabel(category: string) {
    if (category === 'Old Testament') return t('lectionary.oldTestament') // i18n-ignore: upstream schema key
    if (category === 'Other') return t('lectionary.other') // i18n-ignore: upstream schema key
    return category
  }
}

function ReadingChoice({ text, accessibilityLabel, language, selected, disabled, onPress }: {
  text: string; accessibilityLabel: string; language: Language; selected: boolean; disabled: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked: selected, disabled }}
    {...(Platform.OS === 'web' ? { 'aria-checked': selected } : {})} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={{ minHeight: touchTarget, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderRadius: radii.control, borderWidth: 2, borderColor: focused ? colors.focus : 'transparent',
      backgroundColor: selected ? colors.secondary : colors.background }}>
    <AppIcon name={selected ? 'checkbox' : 'unchecked'} color={disabled ? colors.onDisabled : colors.primary} />
    <AppText language={language === 'hy' ? 'grabar' : 'en'} style={{ flex: 1, color: disabled ? colors.onDisabled : colors.foreground }}>{text}</AppText>
  </Pressable>
}
