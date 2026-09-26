import { useCallback, useEffect, useState } from 'react'
import { AppState, ScrollView } from 'react-native'
import { getNetworkStateAsync, addNetworkStateListener } from 'expo-network'
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
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved'>('all')
  const [choosing, setChoosing] = useState(false), [selected, setSelected] = useState<number[]>([])
  const [warning, setWarning] = useState<number[] | null>(null)
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    let active = true
    let observed = false
    const update = (status: { isConnected?: boolean; isInternetReachable?: boolean | null }) => {
      if (active) setOffline(status.isConnected === false || status.isInternetReachable === false)
    }
    void getNetworkStateAsync().then(status => { if (!observed) update(status) }, () => undefined)
    const subscription = addNetworkStateListener(status => { observed = true; update(status) })
    return () => { active = false; subscription.remove() }
  }, [])
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
  const open = (id: number) => router.push({ pathname: '/liturgies/[id]', params: { id: String(id), environment: controller.environment, origin: 'library' } })
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  const entries = new Map<number, Pick<CatalogItem, 'id' | 'name' | 'description' | 'revision'>>(state.catalog.map(entry => [entry.id, entry]))
  state.items.forEach(item => {
    if (!entries.has(item.id)) entries.set(item.id, { ...item.bundle?.liturgy, id: item.id,
      name: item.bundle?.liturgy.name ?? t('library.pending'), description: item.bundle?.liturgy.description ?? null,
      revision: item.bundle?.revision ?? '' })
  })
  const savedItems = state.items.filter(item => item.bundle)
  const visible = [...entries.values()].filter(entry => matches(entry.name) &&
    (filter === 'all' || savedItems.some(item => item.id === entry.id)))
  const active = state.items.some(item => ['downloading', 'updating'].includes(state.status[item.id]))
  return <ScrollView testID="library-screen" contentContainerStyle={{ padding: spacing.page, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    <AppText variant="title" accessibilityRole="header">{t('library.title')}</AppText>
    <AppText tone="muted">{t('library.supporting')}</AppText>
    {!controller.enabled && <AppText accessibilityRole="alert">{t('library.unavailable')}</AppText>}
    {!controller.durable && <AppText tone="muted">{t('library.web')}</AppText>}
    <TextField label={t('library.search')} placeholder={t('library.search')} value={query} onChangeText={setQuery} />
    <SegmentedControl<'all' | 'saved'> label={t('library.filter')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('library.all') }, { value: 'saved', label: t('library.savedFilter') }]} />
    {filter === 'all' && <AppText variant="heading" accessibilityRole="header">{t('library.browse')}</AppText>}
    {offline && <AppText accessibilityLiveRegion="polite">{t('library.offline')}</AppText>}
    {!state.ready && <AppText>{t('library.loading')}</AppText>}
    {state.corrupt > 0 && <AppText accessibilityRole="alert">{t('library.corrupt')}</AppText>}
    {state.storageError && <AppText accessibilityRole="alert">{t(`library.errors.${state.storageError}`)}</AppText>}
    {state.error && !(offline && state.error === 'network') && <AppText accessibilityRole="alert">{t(state.error === 'network' ? 'library.checkError' : `library.errors.${state.error}`)}</AppText>}
    {filter === 'saved' && state.ready && !savedItems.length ? <>
      <AppText variant="heading">{t('library.noDownloads')}</AppText>
      <AppText tone="muted">{t('library.emptySavedHelp')}</AppText>
    </> : visible.map(entry => {
      const saved = savedItems.find(item => item.id === entry.id)
      const requested = state.items.some(item => item.id === entry.id)
      const status = state.status[entry.id], failure = state.failures[entry.id]
      const busy = status === 'downloading' || status === 'updating'
      const updated = saved?.bundle && saved.bundle.revision !== entry.revision
      return <Surface key={entry.id} style={{ padding: spacing.md, gap: spacing.sm }}>
        <AppText variant="heading">{entry.name}</AppText>
        {entry.description && <AppText tone="muted">{entry.description}</AppText>}
        {saved && <AppText variant="caption" tone="muted">{t(updated ? 'library.updateAvailable' : 'library.downloaded')}</AppText>}
        {busy && <AppText accessibilityLiveRegion="polite">{t(requested ? `library.${status}` : 'library.loading')}</AppText>}
        {failure && <AppText accessibilityRole="alert">
          {t(requested && failure === 'network' ? saved ? 'library.updateError' : 'library.saveError' : requested && failure === 'invalid' ? 'library.saveInvalidError' : `library.errors.${failure}`)}
          {saved && (failure === 'size' || failure === 'invalid') ? ` ${t('library.savedCopyAvailable')}` : ''}
        </AppText>}
        {saved ? <>
          <AppButton onPress={() => open(entry.id)}>{t('library.readSaved')}</AppButton>
          {(updated || failure) && <AppButton variant="secondary" loading={busy} disabled={!controller.enabled || offline || !state.ready} onPress={() => request([entry.id])}>{t('library.update')}</AppButton>}
          <AppButton variant="quiet" onPress={() => { void controller.remove(entry.id).catch(() => undefined) }}>{t('library.remove')}</AppButton>
        </> : <>
          {controller.durable && <AppButton loading={busy} disabled={!controller.enabled || offline || !state.ready} onPress={() => request([entry.id])}>{t('library.download')}</AppButton>}
          <AppButton variant={controller.durable ? 'quiet' : 'primary'} disabled={!controller.enabled || offline || !state.ready || busy} accessibilityHint={t('library.internetRequired')} onPress={() => open(entry.id)}>{t('library.readOnline')}</AppButton>
          <AppText variant="caption" tone="muted">{t('library.internetRequired')}</AppText>
          {requested && <AppButton variant="quiet" onPress={() => { void controller.remove(entry.id).catch(() => undefined) }}>{t('library.removeSelection')}</AppButton>}
        </>}
      </Surface>
    })}
    {state.ready && state.checkedAt !== null && !visible.length && (filter !== 'saved' || savedItems.length > 0) && !state.loading && !state.error && !state.storageError && !offline && <AppText>{t(query ? 'library.noMatches' : 'library.empty')}</AppText>}
    {filter === 'all' && state.next !== null && <>
      <AppText tone="muted">{t('library.partial')}</AppText>
      <AppButton variant="secondary" loading={state.loading} disabled={offline} onPress={() => { void controller.refresh(true, true) }}>{t('library.more')}</AppButton>
    </>}
    <AppButton variant="quiet" loading={state.loading} disabled={!controller.enabled || offline} onPress={() => { void controller.refresh(true) }}>{t('library.refresh')}</AppButton>
    {controller.durable && savedItems.length > 0 && <AppButton variant="quiet" disabled={!controller.enabled || offline || active} onPress={() => request(savedItems.map(item => item.id))}>{t('library.sync')}</AppButton>}
    {active && controller.durable && <AppButton variant="quiet" onPress={controller.cancel}>{t('library.cancel')}</AppButton>}
    {controller.durable && state.recommended.length > 0 && <>
      {!state.dismissed && <AppText variant="heading">{t('library.recommended')}</AppText>}
      <AppButton variant="quiet" disabled={offline} onPress={() => { setSelected(state.recommended.map(c => c.id)); setChoosing(true) }}>{t('library.choose')}</AppButton>
    </>}
    <AppModal visible={choosing} onDismiss={() => setChoosing(false)} title={t('library.choose')}>
      {state.recommended.map(c => <AppButton key={c.id} variant="secondary" accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(c.id) }} selected={selected.includes(c.id)}
        onPress={() => setSelected(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])}>{c.name}</AppButton>)}
      <AppButton disabled={!selected.length || offline || !state.ready} onPress={() => { request(selected); setChoosing(false); void controller.dismiss() }}>{t('library.downloadSelected')}</AppButton>
      <AppButton variant="quiet" onPress={() => { setChoosing(false); void controller.dismiss() }}>{t('library.skip')}</AppButton>
    </AppModal>
    <AppModal visible={warning !== null} onDismiss={() => setWarning(null)} title={t('library.largeTitle')}>
      <AppText>{t('library.large')}</AppText>
      <AppButton disabled={offline || !state.ready} onPress={() => { warning?.forEach(id => { void controller.request(id, true).catch(() => undefined) }); setWarning(null) }}>{t('library.downloadSelected')}</AppButton>
    </AppModal>
  </ScrollView>
}
