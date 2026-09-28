import { useMemo, useRef, useState, useSyncExternalStore, type Ref } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, View } from 'react-native'
import { AppButton } from '../../../components/AppButton'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { TextField } from '../../../components/TextField'
import { spacing } from '../../../design/tokens'
import { useTheme } from '../../../design/ThemeProvider'
import { useI18n } from '../../i18n'
import { matchesTitle, type CatalogController } from './catalog'
import type { LiturgyOption } from './contracts'
import { addLiturgy, moveLiturgy, removeLiturgy, type SessionDraft } from './draft'

export interface LiturgyPickerProps {
  catalog: CatalogController
  selected: LiturgyOption[]
  editable: boolean
  error?: string
  headingRef?: Ref<View>
  onChange(update: (draft: SessionDraft) => SessionDraft): void
}

/**
 * One Liturgies section: the chosen liturgies in their numbered, reorderable order, and an Add Liturgy
 * sheet listing every liturgy this account may add, filtered on the device by title.
 */
export function LiturgyPicker({ catalog, selected, editable, error, headingRef, onChange }: LiturgyPickerProps) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const addRef = useRef<View>(null)
  const announce = (message: string) => { if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message) }
  function move(item: LiturgyOption, offset: -1 | 1, index: number) {
    onChange(draft => moveLiturgy(draft, item.id, offset))
    announce(t('sessionManagement.moved', { name: item.name, position: index + offset + 1 }))
  }
  function add(item: LiturgyOption) {
    onChange(draft => addLiturgy(draft, item))
    setOpen(false)
    announce(t('sessionManagement.addedAt', { name: item.name, position: selected.length + 1 }))
  }

  return <Card>
    <View ref={headingRef} accessible focusable>
      <AppText variant="heading">{t('sessionManagement.liturgies')}</AppText>
    </View>
    <AppText tone="muted">{t('sessionManagement.liturgiesHelp')}</AppText>
    {selected.length === 0 && <AppText tone="muted">{t('sessionManagement.selectedEmpty')}</AppText>}
    {selected.map((item, index) => <View key={item.id} testID={`selected-liturgy-${item.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderTopWidth: index ? 1 : 0, borderTopColor: colors.divider }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
        accessible accessibilityLabel={t('sessionManagement.selectedLabel', { position: index + 1, total: selected.length, name: item.name })}>
        <AppText variant="label" style={{ minWidth: 24, color: colors.primary }}>{`${index + 1}.`}</AppText>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText>{item.name}</AppText>
          {!item.selectable && <AppText variant="caption" tone="muted">{t('sessionManagement.notSelectable')}</AppText>}
        </View>
      </View>
      <AppButton variant="quiet" icon="up" iconOnly disabled={!editable || index === 0}
        accessibilityLabel={t('sessionManagement.moveUpLabel', { name: item.name })} onPress={() => move(item, -1, index)}>{t('sessionManagement.moveUp')}</AppButton>
      <AppButton variant="quiet" icon="down" iconOnly disabled={!editable || index === selected.length - 1}
        accessibilityLabel={t('sessionManagement.moveDownLabel', { name: item.name })} onPress={() => move(item, 1, index)}>{t('sessionManagement.moveDown')}</AppButton>
      <AppButton variant="quiet" icon="close" iconOnly disabled={!editable}
        accessibilityLabel={t('sessionManagement.removeLabel', { name: item.name })} onPress={() => onChange(draft => removeLiturgy(draft, item.id))}>{t('sessionManagement.remove')}</AppButton>
    </View>)}
    {error && <AppText tone="destructive" accessibilityRole="alert">{error}</AppText>}
    <View style={{ alignSelf: 'flex-start' }}>
      <AppButton ref={addRef} testID="add-liturgy" variant="secondary" size="card" icon="add" disabled={!editable}
        accessibilityHint={t('sessionManagement.addLiturgyHint')} onPress={() => { catalog.ensureLoaded(); setOpen(true) }}>{t('sessionManagement.addLiturgy')}</AppButton>
    </View>
    <AddLiturgySheet visible={open} catalog={catalog} selected={selected} openerRef={addRef} onAdd={add} onDismiss={() => setOpen(false)} />
  </Card>
}

function AddLiturgySheet({ visible, catalog, selected, openerRef, onAdd, onDismiss }: {
  visible: boolean; catalog: CatalogController; selected: LiturgyOption[]; openerRef: React.RefObject<View | null>
  onAdd(item: LiturgyOption): void; onDismiss(): void
}) {
  const { t } = useI18n()
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot)
  const [query, setQuery] = useState('')
  const chosen = new Set(selected.map(item => item.id))
  const matches = useMemo(() => state.liturgies.filter(item => matchesTitle(item.name, query)), [state.liturgies, query])
  return <AppModal visible={visible} onDismiss={onDismiss} title={t('sessionManagement.addLiturgy')} dismissLabel={t('common.cancel')}
    openerRef={openerRef} onAfterDismiss={() => setQuery('')}>
    <TextField label={t('sessionManagement.filterLiturgies')} placeholder={t('sessionManagement.filterPlaceholder')} value={query} onChangeText={setQuery}
      autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
    {state.loading && <ActivityIndicator accessibilityLabel={t('sessionManagement.catalogLoading')} />}
    {state.error && <View style={{ gap: spacing.sm }}>
      <AppText accessibilityRole="alert" tone="destructive">{state.error}</AppText>
      {!state.unavailable && <AppButton variant="secondary" onPress={() => void catalog.retry()}>{t('common.retry')}</AppButton>}
    </View>}
    {state.complete && state.liturgies.length === 0 && <AppText tone="muted">{t('sessionManagement.catalogEmpty')}</AppText>}
    {state.complete && state.liturgies.length > 0 && matches.length === 0 && <AppText tone="muted" accessibilityLiveRegion="polite">{t('sessionManagement.catalogNoMatches')}</AppText>}
    {matches.map(item => {
      const added = chosen.has(item.id)
      return <AppButton key={item.id} variant="row" disabled={added}
        accessibilityLabel={t(added ? 'sessionManagement.addedLabel' : 'sessionManagement.addLabel', { name: item.name })}
        onPress={() => onAdd(item)}>{added ? t('sessionManagement.addedRow', { name: item.name }) : item.name}</AppButton>
    })}
  </AppModal>
}
