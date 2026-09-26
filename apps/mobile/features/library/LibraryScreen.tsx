import { useCallback, useState } from 'react'
import { AppState, ScrollView } from 'react-native'
import { addNetworkStateListener } from 'expo-network'
import { router, useFocusEffect } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { TextField } from '../../components/TextField'
import { SegmentedControl } from '../../components/SegmentedControl'
import { Card as Surface } from '../../components/Surface'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { useLibrary } from './LibraryProvider'
import type { CatalogItem } from './contracts'

export function LibraryScreen() {
  const { controller, state } = useLibrary(), { t } = useI18n()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'downloaded'>('all')
  const [choosing, setChoosing] = useState(false), [selected, setSelected] = useState<number[]>([])
  const [warning, setWarning] = useState<number[] | null>(null)
  useFocusEffect(useCallback(() => {
    void controller.refresh()
    const app = AppState.addEventListener('change', status => { if (status === 'active') void controller.refresh() })
    const network = addNetworkStateListener(status => { if (AppState.currentState === 'active' && status.isConnected && status.isInternetReachable !== false) void controller.refresh() })
    return () => { app.remove(); network.remove() }
  }, [controller]))
  const request = (ids: number[]) => {
    if (ids.some(id => (state.catalog.find(c => c.id === id)?.download_bytes ?? state.recommended.find(c => c.id === id)?.download_bytes ?? 0) >= 5 * 1024 * 1024)) { setWarning(ids); return }
    ids.forEach(id => { void controller.request(id, true).catch(() => undefined) })
  }
  const open = (id: number) => router.push({ pathname: '/liturgies/[id]', params: { id: String(id), environment: controller.environment } })
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  const card = (entry: CatalogItem) => {
    const saved = state.items.find(i => i.id === entry.id), status = state.status[entry.id]
    const busy = status === 'downloading' || status === 'updating'
    return <Surface key={entry.id}><AppText variant="heading">{entry.name}</AppText>
      {entry.description && <AppText tone="muted">{entry.description}</AppText>}
      <AppText variant="caption">{t(saved?.bundle ? saved.bundle.revision !== entry.revision ? 'library.updateAvailable' : 'library.downloaded' : 'library.notDownloaded')}</AppText>
      {status && <AppText accessibilityLiveRegion="polite">{t(`library.${status}`)}</AppText>}
      {state.failures[entry.id] && <AppText accessibilityRole="alert">{t(`library.errors.${state.failures[entry.id]}`)}</AppText>}
      <AppButton variant="secondary" onPress={() => open(entry.id)}>{t(saved?.bundle ? 'library.readSaved' : 'library.readOnline')}</AppButton>
      {controller.durable && <AppButton loading={busy} disabled={busy || !state.ready} onPress={() => request([entry.id])}>{t(saved?.bundle ? 'library.update' : 'library.download')}</AppButton>}
    </Surface>
  }
  return <ScrollView testID="library-screen" contentContainerStyle={{ padding: spacing.page, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    {!controller.enabled && <AppText accessibilityRole="alert">{t('library.unavailable')}</AppText>}
    {!controller.durable && <AppText tone="muted">{t('library.web')}</AppText>}
    <AppText variant="heading" accessibilityRole="header">{t('library.downloaded')}</AppText>
    {!state.ready && <AppText>{t('library.loading')}</AppText>}
    {state.corrupt > 0 && <AppText accessibilityRole="alert">{t('library.corrupt')}</AppText>}
    {state.ready && !state.items.length && <AppText tone="muted">{t('library.noDownloads')}</AppText>}
    {state.items.map(saved => <Surface key={saved.id}>
      <AppText variant="heading">{saved.bundle?.liturgy.name ?? state.catalog.find(c => c.id === saved.id)?.name ?? t('library.pending')}</AppText>
      {saved.bundle && <>
        <AppText>{t('library.saved', { date: new Date(saved.savedAt!).toLocaleDateString() })}</AppText>
        <AppButton onPress={() => open(saved.id)}>{t('library.readSaved')}</AppButton>
        {state.catalog.some(c => c.id === saved.id && c.revision !== saved.bundle!.revision) && <AppText>{t('library.updateAvailable')}</AppText>}
      </>}
      {state.status[saved.id] && <AppText accessibilityLiveRegion="polite">{t(`library.${state.status[saved.id]}`)}</AppText>}
      {state.failures[saved.id] && <AppText accessibilityRole="alert">{t(`library.errors.${state.failures[saved.id]}`)}</AppText>}
      <AppButton variant="secondary" disabled={!controller.enabled || ['downloading', 'updating'].includes(state.status[saved.id])} onPress={() => request([saved.id])}>{t(saved.bundle ? 'library.update' : 'library.retry')}</AppButton>
      <AppButton variant="quiet" onPress={() => { void controller.remove(saved.id).catch(() => undefined) }}>{t('library.remove')}</AppButton>
    </Surface>)}
    {controller.durable && <>
      <AppText tone="muted">{t('library.syncHelp')}</AppText>
      <AppButton variant="secondary" disabled={!controller.enabled || !state.items.length} onPress={() => request(state.items.map(i => i.id))}>{t('library.sync')}</AppButton>
      <AppButton variant="quiet" onPress={controller.cancel}>{t('library.cancel')}</AppButton>
    </>}
    {controller.durable && state.recommended.length > 0 && <>
      {!state.dismissed && <AppText variant="heading">{t('library.recommended')}</AppText>}
      <AppButton variant="secondary" onPress={() => { setSelected(state.recommended.map(c => c.id)); setChoosing(true) }}>{t('library.choose')}</AppButton>
    </>}
    <AppText variant="heading" accessibilityRole="header">{t('library.browse')}</AppText>
    <TextField label={t('library.search')} value={query} onChangeText={setQuery} />
    <SegmentedControl<'all' | 'downloaded'> label={t('library.filter')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('library.all') }, { value: 'downloaded', label: t('library.downloaded') }]} />
    {state.error && <AppText accessibilityRole="alert">{t(`library.errors.${state.error}`)}</AppText>}
    <AppText tone="muted">{state.checkedAt ? t('library.checked', { date: new Date(state.checkedAt).toLocaleString() }) : t('library.unknown')}</AppText>
    {(state.next !== null || state.loading || state.error) && <AppText tone="muted">{t('library.partial')}</AppText>}
    {state.catalog.filter(c => matches(c.name) && (filter === 'all' || state.items.some(i => i.id === c.id && i.bundle))).map(card)}
    {!state.loading && !state.error && state.checkedAt !== null && !state.catalog.length && <AppText>{t('library.empty')}</AppText>}
    {state.next !== null && <AppButton loading={state.loading} onPress={() => { void controller.refresh(true, true) }}>{t('library.more')}</AppButton>}
    <AppButton variant="secondary" loading={state.loading} disabled={!controller.enabled} onPress={() => { void controller.refresh(true) }}>{t('library.refresh')}</AppButton>
    <AppText variant="caption" tone="muted">{t('library.policy')}</AppText>
    <AppModal visible={choosing} onDismiss={() => setChoosing(false)} title={t('library.choose')}>
      {state.recommended.map(c => <AppButton key={c.id} variant="secondary" accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(c.id) }} selected={selected.includes(c.id)}
        onPress={() => setSelected(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])}>{c.name}</AppButton>)}
      <AppButton disabled={!selected.length} onPress={() => { request(selected); setChoosing(false); void controller.dismiss() }}>{t('library.downloadSelected')}</AppButton>
      <AppButton variant="quiet" onPress={() => { setChoosing(false); void controller.dismiss() }}>{t('library.skip')}</AppButton>
    </AppModal>
    <AppModal visible={warning !== null} onDismiss={() => setWarning(null)} title={t('library.largeTitle')}>
      <AppText>{t('library.large')}</AppText>
      <AppButton onPress={() => { warning?.forEach(id => { void controller.request(id, true).catch(() => undefined) }); setWarning(null) }}>{t('library.downloadSelected')}</AppButton>
    </AppModal>
  </ScrollView>
}
