import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TVFocusGuideView, View } from 'react-native'
import { FocusButton } from '../components/FocusButton'
import type { DirectoryChurch, PublicDirectoryApi } from '../directory'
import { useI18n } from '../i18n'
import { colors, safe, space, type } from '../theme'
import { useLoad } from '../useLoad'

interface Props {
  api: PublicDirectoryApi
  /** The church left last, so Back from its displays lands where the viewer was. */
  preferredId: string | null
  onChoose(church: DirectoryChurch): void
  onBack(): void
}

interface More { key: string; items: DirectoryChurch[]; next: string | null; loaded: boolean; status: 'idle' | 'loading' | 'error' }

/**
 * Installation setup, step one: the public church directory, including churches with no live service.
 * Works with the remote alone; the search field is optional and uses the tvOS keyboard when focused.
 */
export function ChurchesScreen({ api, preferredId, onChoose, onBack }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const key = `churches:${query}`
  const [first, reload] = useLoad(key, useCallback((signal: AbortSignal) => api.churches(query, null, signal), [api, query]))
  const [more, setMore] = useState<More>({ key, items: [], next: null, loaded: false, status: 'idle' })
  const pending = useRef<AbortController | null>(null)
  const extra = more.key === key ? more : { key, items: [], next: null, loaded: false, status: 'idle' as const }

  const firstPage = first.status === 'ready' ? first.data : null
  const items = firstPage ? [...firstPage.churches, ...extra.items.filter(item => !firstPage.churches.some(known => known.id === item.id))] : []
  // The next page follows the last one loaded; a failed attempt keeps the cursor it started from.
  const cursor = firstPage ? (extra.loaded ? extra.next : firstPage.nextCursor) : null

  async function loadMore() {
    if (!cursor || extra.status === 'loading') return
    pending.current?.abort()
    const abort = new AbortController()
    pending.current = abort
    setMore({ ...extra, key, status: 'loading' })
    try {
      const page = await api.churches(query, cursor, abort.signal)
      if (!abort.signal.aborted) setMore({ key, items: [...extra.items, ...page.churches], next: page.nextCursor, loaded: true, status: 'idle' })
    } catch {
      if (!abort.signal.aborted) setMore({ ...extra, key, status: 'error' })
    }
  }
  const submit = () => { pending.current?.abort(); setQuery(draft.trim()) }
  const clear = () => { pending.current?.abort(); setDraft(''); setQuery('') }
  const focusId = items.some(church => church.id === preferredId) ? preferredId : items[0]?.id ?? null

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">{t('churches.title')}</Text>
      <Text style={styles.intro}>{t('churches.intro')}</Text>
      <TVFocusGuideView autoFocus style={styles.search}>
        <SearchField value={draft} onChangeText={setDraft} onSubmit={submit} placeholder={t('churches.searchPlaceholder')} />
        <FocusButton testID="churches-search" label={t('churches.search')} onPress={submit} />
        {query ? <FocusButton testID="churches-clear" label={t('churches.showAll')} onPress={clear} /> : null}
      </TVFocusGuideView>

      <TVFocusGuideView autoFocus style={styles.list}>
        {first.status === 'loading' ? <Text testID="churches-loading" style={styles.messageText}>{t('churches.loading')}</Text>
          : first.status === 'error' ? (
            <View style={styles.message}>
              <Text testID="churches-failed" style={styles.messageText}>{t('churches.failed')}</Text>
              <View style={styles.inline}><FocusButton testID="churches-retry" label={t('churches.retry')} variant="primary" hasTVPreferredFocus onPress={reload} /></View>
            </View>
          ) : !items.length ? (
            <Text testID={query ? 'churches-no-matches' : 'churches-empty'} style={styles.messageText}>{query ? t('churches.noMatches', { query }) : t('churches.empty')}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.cards}>
              {items.map(church => (
                <View key={church.id} style={styles.cardSlot}>
                  <FocusButton testID={`church-${church.id}`} variant="card" label={church.name} detail={church.locality ?? undefined}
                    hasTVPreferredFocus={church.id === focusId} onPress={() => onChoose(church)} />
                </View>
              ))}
              {cursor ? (
                <View style={styles.cardSlot}>
                  {extra.status === 'error' ? <Text testID="churches-more-failed" style={styles.hint}>{t('churches.moreFailed')}</Text> : null}
                  <FocusButton testID="churches-more" label={t('churches.more')} detail={extra.status === 'loading' ? t('churches.loading') : undefined} onPress={() => { void loadMore() }} />
                </View>
              ) : null}
            </ScrollView>
          )}
      </TVFocusGuideView>

      <View style={styles.actions}><FocusButton testID="churches-back" label={t('churches.back')} onPress={onBack} /></View>
    </View>
  )
}
function SearchField({ value, onChangeText, onSubmit, placeholder }: { value: string; onChangeText(value: string): void; onSubmit(): void; placeholder: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput testID="churches-query" value={value} onChangeText={onChangeText} onSubmitEditing={onSubmit} placeholder={placeholder}
      placeholderTextColor={colors.textSecondary} returnKeyType="search" autoCorrect={false} autoCapitalize="none"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.field, focused && styles.fieldFocused]} />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  intro: { color: colors.textSecondary, fontSize: type.body, marginTop: space.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  field: { minWidth: 800, color: colors.textPrimary, fontSize: type.body, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, borderWidth: 4, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: space.lg, paddingVertical: space.md },
  fieldFocused: { borderColor: colors.focus },
  list: { flex: 1, marginTop: space.sm, marginHorizontal: -space.xl },
  cards: { gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.xl },
  cardSlot: { maxWidth: 1100, gap: space.xs },
  message: { gap: space.md, paddingHorizontal: space.xl },
  messageText: { color: colors.textPrimary, fontSize: type.heading, paddingHorizontal: space.xl, paddingVertical: space.lg },
  hint: { color: colors.textSecondary, fontSize: type.body },
  inline: { flexDirection: 'row' },
  actions: { flexDirection: 'row', paddingTop: space.md },
})
