import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { TextField } from '../../components/TextField'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import type { Bundle } from './contracts'
import { createTextFindIndex, searchTextFind, type TextJumpTarget } from './textFind'

/** Local to the pinned bundle; changing the language invalidates every old result. */
export function ReaderFind({ bundle, language, jump, close }: {
  bundle: Bundle; language: Language; jump(target: TextJumpTarget | null, focus?: boolean): void; close(): void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState(''), [settled, setSettled] = useState('')
  const [selected, setSelected] = useState(0), [navigation, setNavigation] = useState(0)
  const focusMatch = useRef(false)
  const index = useMemo(() => createTextFindIndex(bundle, language), [bundle, language])
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 180)
    return () => clearTimeout(timer)
  }, [query])
  const result = useMemo(() => searchTextFind(index, settled), [index, settled])
  // Keep selection tied to the result set, not to an occurrence in another language/query.
  const [previous, setPrevious] = useState(result)
  if (previous !== result) { setPrevious(result); setSelected(0) }
  const pending = query !== settled
  const match = !pending ? result.matches[selected] : undefined
  useEffect(() => {
    jump(match ?? null, focusMatch.current)
    focusMatch.current = false
  }, [match, jump, navigation])
  const move = (direction: number) => {
    Keyboard.dismiss()
    focusMatch.current = true
    setSelected(value => (value + direction + result.matches.length) % result.matches.length)
    setNavigation(value => value + 1)
  }
  const dismiss = () => { Keyboard.dismiss(); close() }
  const status = pending ? t('library.findSearching') : !settled.trim() ? t('library.findHelp') : result.matches.length
    ? t(result.truncated ? 'library.findCountLimited' : 'library.findCount', { current: selected + 1, count: result.matches.length })
    : t('library.findEmpty')
  return <View testID="library-reader-find" onAccessibilityEscape={dismiss}
    style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs }}>
    <TextField label={t('library.find')} placeholder={t('library.findPlaceholder')} value={query} autoFocus
      autoCapitalize="none" autoCorrect={false} maxLength={256} returnKeyType="search"
      onChangeText={setQuery} onKeyPress={event => { if (event.nativeEvent.key === 'Escape') dismiss() }} onSubmitEditing={() => { if (result.matches.length && !pending) move(1) }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
      <AppText variant="caption" accessibilityLiveRegion="polite" style={{ flexGrow: 1, flexShrink: 1 }}>{status}</AppText>
      <AppButton variant="quiet" icon="back" iconOnly disabled={!match} onPress={() => move(-1)}>{t('library.findPrevious')}</AppButton>
      <AppButton variant="quiet" icon="next" iconOnly disabled={!match} onPress={() => move(1)}>{t('library.findNext')}</AppButton>
      <AppButton variant="quiet" icon="close" iconOnly onPress={dismiss}>{t('library.findClose')}</AppButton>
    </View>
  </View>
}
