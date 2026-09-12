import { useCallback, useEffect, useRef } from 'react'
import { FlatList, Platform, Pressable, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { Card } from '../../components/Surface'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import type { LivePart } from './contracts'
export function PartList({ parts, currentKey, following, language, manual, open }: { parts: LivePart[]; currentKey?: string; following: boolean; language: Language; manual(): void; open(part: LivePart): void }) {
  const { colors } = useTheme()
  const list = useRef<FlatList<LivePart>>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempts = useRef(0)
  const manualOffset = useRef(0)
  const previousLanguage = useRef(language)
  const index = parts.findIndex(p => p.key === currentKey)
  const cancel = useCallback(() => { if (retry.current) clearTimeout(retry.current); retry.current = null }, [])
  const target = useCallback(() => { if (following && index >= 0) list.current?.scrollToIndex({ index, animated: false, viewPosition: 0 }) }, [following, index])
  useEffect(() => {
    attempts.current = 0
    const languageChanged = previousLanguage.current !== language
    previousLanguage.current = language
    if (following) target()
    else if (languageChanged) list.current?.scrollToOffset({ offset: manualOffset.current, animated: false })
    return cancel
  }, [target, language, cancel, following])
  const stopFollowing = () => { cancel(); manual() }
  return <View style={{ flex: 1 }} {...(Platform.OS === 'web' ? { onWheel: stopFollowing, onTouchMove: stopFollowing,
    onKeyDown: (event: { key: string }) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopFollowing() } } : {})}>
    <FlatList key={language} ref={list} data={parts} keyExtractor={p => p.key} onContentSizeChange={target} onLayout={target} extraData={`${currentKey}:${language}`} onScrollBeginDrag={stopFollowing} onScroll={event => { manualOffset.current = event.nativeEvent.contentOffset.y }} scrollEventThrottle={100}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, width: '100%', maxWidth: 800, alignSelf: 'center' }}
      onScrollToIndexFailed={info => {
        cancel()
        if (!following || attempts.current++ >= 12) return
        list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
        retry.current = setTimeout(target, 150)
      }}
      ListEmptyComponent={<AppText>No reading parts are available for this service.</AppText>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityHint="Opens this part in every language, with its explanations."
        accessibilityLabel={`${item.position} ${item.role}${item.key === currentKey ? ', current part' : ''}`} onPress={() => open(item)}>
        <Card testID={`reading-${item.key}`} style={{ borderWidth: 2, borderColor: item.key === currentKey ? colors.primary : 'transparent' }}>
          <AppText variant="label" tone={item.key === currentKey ? 'accent' : 'muted'}>{`${item.position} / ${item.role}${item.key === currentKey ? ' · Current part' : ''}`}</AppText>
          <LiturgyText language={language} text={item.text[language]} />
        </Card>
      </Pressable>} />
  </View>
}
