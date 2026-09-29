import { useEffect, useRef, type ReactNode } from 'react'
import { AccessibilityInfo, findNodeHandle, Platform, TextInput, View } from 'react-native'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { TextField } from '../../../components/TextField'
import { spacing } from '../../../design/tokens'
import { useI18n } from '../../i18n'
import { formatServiceDate } from '../api'
import type { CatalogController } from './catalog'
import { isCalendarDate, OPTION_KEYS, type OptionKey } from './contracts'
import { FORM_FIELDS, shiftDate, type FormField, type SessionDraft } from './draft'
import { LiturgyPicker } from './LiturgyPicker'

export interface SessionFormProps {
  draft: SessionDraft
  timeZone: string | null
  editable: boolean
  fields: Partial<Record<FormField, string>>
  /** Each increment moves focus to the first field with an error. */
  focusRequest: number
  catalog: CatalogController
  readingAssistant?: ReactNode
  onDate(date: string): void
  onOption(key: OptionKey, value: string): void
  onChange(update: (draft: SessionDraft) => SessionDraft): void
}

/** The controlled setup form shared by New Session and Edit Session: date, ordered liturgies, readings and messages. */
export function SessionForm({ draft, timeZone, editable, fields, focusRequest, catalog, readingAssistant, onDate, onOption, onChange }: SessionFormProps) {
  const { t } = useI18n()
  const dateRef = useRef<TextInput>(null)
  const liturgiesRef = useRef<View>(null)
  const optionRefs = useRef<Partial<Record<OptionKey, TextInput | null>>>({})
  const fieldsRef = useRef(fields)
  useEffect(() => { fieldsRef.current = fields }, [fields])
  useEffect(() => {
    if (!focusRequest) return
    const first = FORM_FIELDS.find(field => fieldsRef.current[field])
    if (!first) return
    if (first === 'date') dateRef.current?.focus()
    else if (first === 'liturgy_ids') focusView(liturgiesRef.current)
    else optionRefs.current[first]?.focus()
  }, [focusRequest])
  const preview = isCalendarDate(draft.date) ? formatServiceDate(draft.date) : null
  const help = timeZone ? t('sessionManagement.dateHelp', { example: '2026-10-04', zone: timeZone }) : t('sessionManagement.dateFormat', { example: '2026-10-04' })

  return <View style={{ gap: spacing.md }}>
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <AppButton variant="secondary" size="card" icon="back" iconOnly accessibilityLabel={t('sessionManagement.previousDay')}
          disabled={!editable || !isCalendarDate(draft.date)} onPress={() => onDate(shiftDate(draft.date, -1))}>{t('sessionManagement.previousDay')}</AppButton>
        <View style={{ flex: 1 }}>
          <TextField ref={dateRef} label={t('sessionManagement.date')} value={draft.date} onChangeText={onDate} editable={editable}
            autoCapitalize="none" autoCorrect={false} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            placeholder="YYYY-MM-DD" maxLength={10} // i18n-ignore: a date format, not copy
            accessibilityHint={fields.date ?? help} style={{ textAlign: 'center' }} />
        </View>
        <AppButton variant="secondary" size="card" icon="next" iconOnly accessibilityLabel={t('sessionManagement.nextDay')}
          disabled={!editable || !isCalendarDate(draft.date)} onPress={() => onDate(shiftDate(draft.date, 1))}>{t('sessionManagement.nextDay')}</AppButton>
      </View>
      {fields.date && <AppText tone="destructive" variant="caption" accessibilityRole="alert">{fields.date}</AppText>}
      {preview && <AppText variant="label" accessibilityLiveRegion="polite">{preview}</AppText>}
      <AppText variant="caption" tone="muted">{help}</AppText>
    </Card>
    <LiturgyPicker catalog={catalog} selected={draft.liturgies} editable={editable} error={fields.liturgy_ids} headingRef={liturgiesRef} onChange={onChange} />
    <Card>
      <AppText variant="heading">{t('sessionManagement.readings')}</AppText>
      <AppText tone="muted">{t('sessionManagement.readingsHelp')}</AppText>
      {readingAssistant}
      {OPTION_KEYS.map(key => <TextField key={key} ref={input => { optionRefs.current[key] = input }} label={t(`sessionManagement.${key}`)}
        value={draft.options[key]} onChangeText={value => onOption(key, value)} editable={editable} error={fields[key]}
        multiline={key === 'before_message' || key === 'after_message'} style={key === 'before_message' || key === 'after_message' ? { minHeight: 96 } : undefined} />)}
    </Card>
  </View>
}

function focusView(target: View | null) {
  if (!target) return
  if (Platform.OS === 'web') (target as unknown as HTMLElement).focus?.()
  else {
    const handle = findNodeHandle(target)
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
  }
}
