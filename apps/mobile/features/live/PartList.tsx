import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { AccessibilityInfo, FlatList, Platform, Pressable, useWindowDimensions, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { AppButton } from '../../components/AppButton'
import { LiturgyText } from '../../components/LiturgyText'
import { useTheme } from '../../design/ThemeProvider'
import { readingSizes, spacing, type ReadingSize } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import { SwipeablePart } from './SwipeablePart'
import type { LivePart } from './contracts'

export function PartList({ parts, currentKey, following, language, selectedLanguages, manual, open, switchLanguage,
  readingSize = 'standard', paused = false, header, compact = false }: {
  parts: LivePart[]; currentKey?: string; following: boolean; language: Language; selectedLanguages: readonly Language[]
  manual(): void; open(part: LivePart): void; switchLanguage?(language: Language): void; readingSize?: ReadingSize
  paused?: boolean; header?: ReactElement; compact?: boolean
}) {
  const { colors, scheme } = useTheme()
  const { fontScale } = useWindowDimensions()
  const [width, setWidth] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(true)
  const list = useRef<FlatList<LivePart>>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempts = useRef(0)
  const manualOffset = useRef(0)
  const previousLanguage = useRef(language)
  const previousKey = useRef(currentKey)
  const headerHeight = useRef(0)
  const page = fontScale > 2 ? spacing.md : spacing.page
  // Measure the actual safe-area-constrained list, including reading-size choice.
  const columnIndent = spacing.md
  const readingWidth = width - page * 2 - spacing.lg * Math.max(selectedLanguages.length - 1, 0)
  const compare = selectedLanguages.length > 1 && readingWidth / selectedLanguages.length - columnIndent >= 300 * fontScale * readingSizes[readingSize].fontSize / 24
  const visibleLanguages = compare ? [language, ...selectedLanguages.filter(value => value !== language)] : [language]
  const index = parts.findIndex(p => p.key === currentKey)
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => { active = false; subscription.remove() }
  }, [])
  const cancel = useCallback(() => { if (retry.current) clearTimeout(retry.current); retry.current = null }, [])
  const revealedKey = useRef<string | undefined>(undefined)
  const target = useCallback((animated = false) => {
    if (!following || index < 0) return
    list.current?.scrollToIndex({ index, animated, viewPosition: 0,
      viewOffset: index === 0 && !compact ? headerHeight.current : 0 })
    // Only count the header as revealed once it has a measured height to reveal.
    if (index === 0 && (compact || headerHeight.current > 0)) revealedKey.current = currentKey
  }, [following, index, compact, currentKey])
  // Layout passes re-anchor the current part. Once the first part has been shown under the
  // header, a header that grows (for example a new status) is absorbed by
  // maintainVisibleContentPosition instead of scrolling the prayer text down.
  const settle = useCallback(() => { if (!(index === 0 && revealedKey.current === currentKey)) target() }, [index, currentKey, target])
  useEffect(() => {
    attempts.current = 0
    const languageChanged = previousLanguage.current !== language
    const advanced = previousKey.current !== undefined && previousKey.current !== currentKey
    previousLanguage.current = language
    previousKey.current = currentKey
    if (following) target(advanced && !reduceMotion)
    else if (languageChanged) list.current?.scrollToOffset({ offset: manualOffset.current, animated: false })
    return cancel
  }, [target, language, cancel, following, currentKey, reduceMotion])
  const stopFollowing = () => { cancel(); manual() }
  return <View style={{ flex: 1 }} onLayout={event => setWidth(Math.min(event.nativeEvent.layout.width, 1152))}
    {...(Platform.OS === 'web' ? { onWheel: stopFollowing, onTouchMove: stopFollowing,
      onKeyDown: (event: { key: string }) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopFollowing() } } : {})}>
    <FlatList testID="reading-list" ref={list} data={parts} keyExtractor={p => p.key} onContentSizeChange={settle} onLayout={settle}
      extraData={`${currentKey}:${language}:${visibleLanguages.join(',')}:${readingSize}`} onScrollBeginDrag={stopFollowing}
      // Status pills live in the list header. Anchor on the first visible part (VirtualizedList
      // skips the header itself) so a status change never moves prayer text.
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      onScroll={event => { manualOffset.current = event.nativeEvent.contentOffset.y }} scrollEventThrottle={100}
      contentContainerStyle={{ paddingBottom: spacing.xxl, width: '100%', maxWidth: 1152, alignSelf: 'center' }}
      ListHeaderComponent={header ? <View onLayout={event => { headerHeight.current = event.nativeEvent.layout.height }}>
        {header}
      </View> : null}
      onScrollToIndexFailed={info => {
        cancel()
        if (!following || attempts.current++ >= 12) return
        list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
        retry.current = setTimeout(() => target(), 150)
      }}
      ListEmptyComponent={<AppText style={{ padding: page }}>No reading parts are available for this service.</AppText>}
      renderItem={({ item, index: itemIndex }) => {
        const current = item.key === currentKey
        const past = index >= 0 && itemIndex < index
        const alternatives = selectedLanguages.filter(value => item.text[value]?.trim())
        // Position is occurrence identity, not reader-facing content; keep it out of spoken labels.
        return <SwipeablePart testID={`swipe-${item.key}`} partLabel={item.role}
          reduceMotion={reduceMotion} onSwipeStart={stopFollowing} onOpen={() => open(item)}>
          <View testID={`reading-${item.key}`} style={{ paddingHorizontal: page, paddingVertical: spacing.lg,
          gap: spacing.sm, backgroundColor: current ? colors.surface : colors.background, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          {current && <View accessible={false} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, backgroundColor: colors.currentRule }} />}
          <Pressable accessibilityRole="button" accessibilityHint="Opens this part in every language, with its explanations."
            accessibilityLabel={`${item.role}${current ? ', current part' : ''}`} onPress={() => open(item)}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="label" tone={current && scheme === 'light' ? 'accent' : 'muted'} style={{ textTransform: 'capitalize' }}>{item.role}</AppText>
            {current && <AppText variant="caption" tone="muted">{paused ? 'PAUSED HERE' : 'NOW'}</AppText>}
          </Pressable>
          <View testID={`reading-languages-${item.key}`} style={{ flexDirection: compare ? 'row' : 'column', gap: spacing.lg }}>
            {visibleLanguages.map(visibleLanguage => <View key={visibleLanguage} style={{ flex: compare ? 1 : undefined, minWidth: 0,
              gap: spacing.sm, paddingLeft: compare ? columnIndent - (visibleLanguage === language ? 3 : 1) : 0,
              borderLeftWidth: compare ? visibleLanguage === language ? 3 : 1 : 0,
              borderLeftColor: visibleLanguage === language ? colors.currentRule : colors.divider }}>
              {compare && <AppText variant="label">{sampleLanguages.find(candidate => candidate.value === visibleLanguage)?.label ?? visibleLanguage}
                {visibleLanguage === language ? ' · reading' : ' · comparison'}</AppText>}
              <LiturgyText language={visibleLanguage} text={item.text[visibleLanguage]} readingSize={readingSize} compactStanzas tone={past ? 'muted' : 'default'} />
              {!item.text[visibleLanguage]?.trim() && switchLanguage && alternatives.length > 0 && <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" tone="muted">Choose another reading language for this part.</AppText>
                {alternatives.map(value => <AppButton key={value} variant="secondary" onPress={() => switchLanguage(value)}>
                  {`Read in ${sampleLanguages.find(candidate => candidate.value === value)!.label}`}
                </AppButton>)}
              </View>}
            </View>)}
          </View>
          </View>
        </SwipeablePart>
      }} />
  </View>
}
