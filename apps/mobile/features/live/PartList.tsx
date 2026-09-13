import { useCallback, useEffect, useRef } from 'react'
import { FlatList, Platform, Pressable, useWindowDimensions, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { Card } from '../../components/Surface'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import type { LivePart } from './contracts'
export function PartList({ parts, currentKey, following, language, selectedLanguages, manual, open }: { parts: LivePart[]; currentKey?: string; following: boolean; language: Language; selectedLanguages: readonly Language[]; manual(): void; open(part: LivePart): void }) {
  const { colors } = useTheme()
  const { width, fontScale } = useWindowDimensions()
  const list = useRef<FlatList<LivePart>>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempts = useRef(0)
  const manualOffset = useRef(0)
  const previousLanguage = useRef(language)
  const availableWidth = Math.min(Math.max(width - spacing.md * 2, 0), 1120)
  const readingWidth = availableWidth - spacing.lg * 2 - 4 - spacing.lg * Math.max(selectedLanguages.length - 1, 0)
  const compare = selectedLanguages.length > 1 && readingWidth / selectedLanguages.length >= 300 * fontScale
  const visibleLanguages = compare ? selectedLanguages : [language]
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
    <FlatList key={language} ref={list} data={parts} keyExtractor={p => p.key} onContentSizeChange={target} onLayout={target} extraData={`${currentKey}:${language}:${visibleLanguages.join(',')}`} onScrollBeginDrag={stopFollowing} onScroll={event => { manualOffset.current = event.nativeEvent.contentOffset.y }} scrollEventThrottle={100}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, width: '100%', maxWidth: 1152, alignSelf: 'center' }}
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
          <View testID={`reading-languages-${item.key}`} style={{ flexDirection: compare ? 'row' : 'column', gap: spacing.lg }}>
            {visibleLanguages.map(visibleLanguage => <View key={visibleLanguage} style={{ flex: compare ? 1 : undefined, minWidth: 0, gap: spacing.sm }}>
              {compare && <AppText variant="caption" tone={visibleLanguage === language ? 'accent' : 'muted'}>
                {sampleLanguages.find(item => item.value === visibleLanguage)?.label ?? visibleLanguage}
              </AppText>}
              <LiturgyText language={visibleLanguage} text={item.text[visibleLanguage]} />
            </View>)}
          </View>
        </Card>
      </Pressable>} />
  </View>
}
