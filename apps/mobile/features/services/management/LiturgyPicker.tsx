import { useEffect, useRef, useState, useSyncExternalStore, type Ref } from 'react'
import { AccessibilityInfo, ActivityIndicator, Platform, View } from 'react-native'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { TextField } from '../../../components/TextField'
import { spacing } from '../../../design/tokens'
import { useTheme } from '../../../design/ThemeProvider'
import { useI18n } from '../../i18n'
import type { CatalogController } from './catalog'
import type { LiturgyOption } from './contracts'
import { addLiturgy, moveLiturgy, removeLiturgy, type SessionDraft } from './draft'

const SEARCH_DELAY_MS = 300

export interface LiturgyPickerProps {
  catalog: CatalogController
  selected: LiturgyOption[]
  editable: boolean
  error?: string
  headingRef?: Ref<View>
  onChange(update: (draft: SessionDraft) => SessionDraft): void
}

/** Server-searched choices on one side, an explicitly numbered order on the other. Selection never depends on what is loaded. */
export function LiturgyPicker({ catalog, selected, editable, error, headingRef, onChange }: LiturgyPickerProps) {
  const { t } = useI18n()
  const { colors } = useTheme()
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot)
  const [query, setQuery] = useState(state.query)
  const first = useRef(true)
  useEffect(() => { catalog.start() }, [catalog])
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const timer = setTimeout(() => catalog.search(query), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query, catalog])
  const chosen = new Set(selected.map(item => item.id))
  const announce = (message: string) => { if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message) }
  function move(item: LiturgyOption, offset: -1 | 1, index: number) {
    onChange(draft => moveLiturgy(draft, item.id, offset))
    announce(t('sessionManagement.moved', { name: item.name, position: index + offset + 1 }))
  }

  return <View style={{ gap: spacing.md }}>
    <Card>
      <View ref={headingRef} accessible focusable>
        <AppText variant="heading">{t('sessionManagement.selected')}</AppText>
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
    </Card>
    <Card>
      <AppText variant="heading">{t('sessionManagement.liturgies')}</AppText>
      <TextField label={t('sessionManagement.searchLiturgies')} placeholder={t('sessionManagement.searchPlaceholder')} value={query}
        onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" editable={editable}
        onSubmitEditing={() => catalog.search(query)} />
      {state.loading && <ActivityIndicator accessibilityLabel={t('sessionManagement.catalogLoading')} />}
      {state.error && <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="alert" tone="destructive">{state.error}</AppText>
        {!state.unavailable && <AppButton variant="secondary" onPress={() => void catalog.retry()}>{t('common.retry')}</AppButton>}
      </View>}
      {!state.loading && !state.error && state.complete && state.liturgies.length === 0 &&
        <AppText tone="muted">{t(state.query.trim() ? 'sessionManagement.catalogNoMatches' : 'sessionManagement.catalogEmpty')}</AppText>}
      {state.liturgies.map(item => {
        const added = chosen.has(item.id)
        return <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText style={{ flex: 1 }}>{item.name}</AppText>
          <AppButton variant={added ? 'quiet' : 'secondary'} size="card" icon={added ? 'selected' : undefined} disabled={!editable || added}
            accessibilityLabel={t(added ? 'sessionManagement.addedLabel' : 'sessionManagement.addLabel', { name: item.name })}
            onPress={() => onChange(draft => addLiturgy(draft, item))}>{t(added ? 'sessionManagement.added' : 'sessionManagement.add')}</AppButton>
        </View>
      })}
      {state.loadingMore && <ActivityIndicator accessibilityLabel={t('sessionManagement.catalogLoading')} />}
      {!state.loading && !state.loadingMore && !state.error && state.nextAfterId !== null &&
        <AppButton variant="quiet" onPress={() => void catalog.loadMore()}>{t('sessionManagement.loadMoreLiturgies')}</AppButton>}
      {!state.loading && !state.error && state.complete && state.liturgies.length > 0 &&
        <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">{t('sessionManagement.catalogComplete')}</AppText>}
    </Card>
  </View>
}
