import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Platform, Pressable, useWindowDimensions, View } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { AppButton } from '../../components/AppButton'
import { LiturgyText } from '../../components/LiturgyText'
import { useTheme } from '../../design/ThemeProvider'
import { readingSizes, spacing, type ReadingSize } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import { SwipeablePart } from './SwipeablePart'
import type { LivePart } from './contracts'
import { useI18n } from '../i18n'

const READING_WIDTH = 1152

export function PartList({ parts, currentKey, following, language, selectedLanguages, manual, open, switchLanguage,
  browseSettled, browseMoved, browseMomentum, readingSize = 'standard', paused = false, header, compact = false, topPartChanged }: {
  parts: LivePart[]; currentKey?: string; following: boolean; language: Language; selectedLanguages: readonly Language[]
  browseSettled?(): void; browseMoved?(): void; browseMomentum?(): void; manual(dragging?: boolean): void; open(part: LivePart): void; switchLanguage?(language: Language): void; readingSize?: ReadingSize
  paused?: boolean; header?: ReactElement; compact?: boolean
  /** The first part at least half on screen, for readers without a live position to explain. */
  topPartChanged?(part: LivePart | undefined): void
}) {
  const { fontScale } = useWindowDimensions()
  const [frameWidth, setFrameWidth] = useState(0)
  const list = useRef<FlashListRef<LivePart>>(null)
  const manualOffset = useRef(0)
  const previousLanguage = useRef(language)
  const page = fontScale > 2 ? spacing.md : spacing.page
  // Measure the actual safe-area-constrained list, including reading-size choice. The reading measure stops at
  // READING_WIDTH; wider screens centre it with a gutter on each row, so the whole width still scrolls.
  const width = Math.min(frameWidth, READING_WIDTH)
  const gutter = Math.max(0, Math.floor((frameWidth - READING_WIDTH) / 2))
  const columnIndent = spacing.md
  const minimumColumn = 300 * fontScale * readingSizes[readingSize].fontSize / 24
  const columnWidthFor = (count: number) => Math.floor((width - page * 2 - spacing.lg * (count - 1)) / count)
  // As many columns as keep a readable measure, up to every chosen language: a set too wide for this screen
  // shows its first languages side by side rather than collapsing to one.
  let columns = Math.min(selectedLanguages.length, 3)
  while (columns > 1 && columnWidthFor(columns) - columnIndent < minimumColumn) columns -= 1
  const compare = columns > 1
  // One fixed width for every column in every part, so the reading column never widens or narrows with its text.
  const columnWidth = compare ? columnWidthFor(columns) : undefined
  const visibleKey = (compare ? [language, ...selectedLanguages.filter(value => value !== language)].slice(0, columns) : [language]).join(',')
  const visibleLanguages = useMemo(() => visibleKey.split(',') as Language[], [visibleKey])
  const selectedKey = selectedLanguages.join(',')
  const alternativesFrom = useMemo(() => selectedKey.split(',') as Language[], [selectedKey])
  const index = parts.findIndex(p => p.key === currentKey)


  // Rows are memoized and recycled; they reach the latest callbacks through this ref instead of new functions each render.
  const actions = useRef({ manual, open, switchLanguage, topPartChanged })
  useEffect(() => { actions.current = { manual, open, switchLanguage, topPartChanged } }, [manual, open, switchLanguage, topPartChanged])
  const { t } = useI18n()
  const stopFollowing = useCallback(() => actions.current.manual(), [])
  const openPart = useCallback((part: LivePart) => actions.current.open(part), [])
  const reportTopPart = useCallback(({ viewableItems }: { viewableItems: { item: LivePart }[] }) => actions.current.topPartChanged?.(viewableItems[0]?.item), [])
  const readIn = useMemo(() => switchLanguage ? (value: Language) => actions.current.switchLanguage?.(value) : undefined, [switchLanguage])

  // FlashList measures rows as it goes and corrects its own scroll, so one request lands even on a part hundreds of rows
  // down. The first part scrolls to the very top instead, so the service details above it are shown.
  const target = useCallback(() => {
    if (!following || index < 0) return
    if (index === 0 && !compact) list.current?.scrollToOffset({ offset: 0, animated: false })
    else void list.current?.scrollToIndex({ index, animated: false, viewPosition: 0 })
  }, [following, index, compact])
  // A change of columns, size or language reflows every row, so a following reader is put back on the live part.
  const layoutKey = `${visibleKey}:${readingSize}:${columnWidth}`
  useEffect(() => {
    const languageChanged = previousLanguage.current !== language
    previousLanguage.current = language
    // Live following puts the accepted reading on screen immediately, including long jumps.
    if (following) target()
    else if (languageChanged) list.current?.scrollToOffset({ offset: manualOffset.current, animated: false })
  }, [target, language, following, layoutKey])

  return <View testID="reading-frame" style={{ flex: 1 }} onLayout={event => setFrameWidth(event.nativeEvent.layout.width)}
    {...(Platform.OS === 'web' ? { onWheel: stopFollowing, onTouchMove: stopFollowing,
      onKeyDown: (event: { key: string }) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopFollowing() } } : {})}>
    <FlashList testID="reading-list" ref={list} data={parts} keyExtractor={p => p.key}
      // Opening straight onto the live part avoids drawing and scrolling past everything before it.
      initialScrollIndex={following && index > 0 ? index : undefined} onLoad={() => target()}
      extraData={`${currentKey}:${index}:${layoutKey}:${paused}:${gutter}:${page}`} onScrollBeginDrag={() => actions.current.manual(true)}
      // Status pills live in the list header. FlashList keeps the first visible part anchored by default,
      // so a status change never moves prayer text.
      onScrollEndDrag={browseSettled} onMomentumScrollEnd={browseSettled} onMomentumScrollBegin={browseMomentum}
      {...(topPartChanged ? { onViewableItemsChanged: reportTopPart, viewabilityConfig: { itemVisiblePercentThreshold: 50 } } : {})}
      onScroll={event => { manualOffset.current = event.nativeEvent.contentOffset.y; browseMoved?.() }} scrollEventThrottle={100}
      ListHeaderComponent={header ? <View style={{ paddingHorizontal: gutter }}>{header}</View> : null}
      ListFooterComponent={<View style={{ height: spacing.xxl }} />}
      ListEmptyComponent={<AppText style={{ padding: page, paddingHorizontal: page + gutter }}>{t('common.noReadingParts')}</AppText>}
      renderItem={({ item, index: itemIndex }) => <ReadingRow item={item} current={item.key === currentKey} past={index >= 0 && itemIndex < index}
        paused={paused} language={language} visibleLanguages={visibleLanguages} alternativesFrom={alternativesFrom} compare={compare}
        columnWidth={columnWidth} columnIndent={columnIndent} page={page} gutter={gutter} readingSize={readingSize}
        onSwipeStart={stopFollowing} open={openPart} readIn={readIn} />} />
  </View>
}

const ReadingRow = memo(function ReadingRow({ item, current, past, paused, language, visibleLanguages, alternativesFrom, compare, columnWidth, columnIndent,
  page, gutter, readingSize, onSwipeStart, open, readIn }: {
  item: LivePart; current: boolean; past: boolean; paused: boolean; language: Language; visibleLanguages: readonly Language[]
  alternativesFrom: readonly Language[]; compare: boolean; columnWidth: number | undefined; columnIndent: number; page: number; gutter: number
  readingSize: ReadingSize; onSwipeStart(): void; open(part: LivePart): void; readIn?(language: Language): void
}) {
  const { colors, scheme } = useTheme()
  const { t } = useI18n()
  const alternatives = alternativesFrom.filter(value => item.text[value]?.trim())
  // The row's live-state rule already identifies the active reading column. Keeping its
  // column rule would draw two competing accents, while older rows retain their column rule.
  const openThis = () => open(item)
  // Position is occurrence identity, not reader-facing content; keep it out of spoken labels.
  return <SwipeablePart testID={`swipe-${item.key}`} partLabel={item.role}
    onSwipeStart={onSwipeStart} onOpen={openThis}>
    <View testID={`reading-${item.key}`} style={{ paddingHorizontal: page + gutter, paddingVertical: spacing.lg,
    gap: spacing.sm, backgroundColor: current ? colors.surface : colors.background, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
    {current && <View accessible={false} style={{ position: 'absolute', top: 0, bottom: 0, left: gutter, width: 3, backgroundColor: colors.currentRule }} />}
    <Pressable accessibilityRole="button" accessibilityHint={t('partList.opensPartHint')}
      accessibilityLabel={current ? t('partList.currentPartLabel', { role: item.role }) : item.role} onPress={openThis}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <AppText variant="label" tone={current && scheme === 'light' ? 'accent' : 'muted'} style={{ textTransform: 'capitalize' }}>{item.role}</AppText>
      {current && <AppText variant="caption" tone="muted">{paused ? t('partList.pausedHere') : t('partList.now')}</AppText>}
    </Pressable>
    <View testID={`reading-languages-${item.key}`} style={{ flexDirection: compare ? 'row' : 'column', gap: spacing.lg }}>
      {visibleLanguages.map(visibleLanguage => {
        const suppressActiveColumnRule = current && compare && visibleLanguage === language
        return <View key={visibleLanguage} testID={`reading-column-${item.key}-${visibleLanguage}`}
        style={{ width: columnWidth, flexGrow: 0, flexShrink: 0, minWidth: 0,
        gap: spacing.sm, paddingLeft: compare ? columnIndent - (suppressActiveColumnRule ? 0 : visibleLanguage === language ? 3 : 1) : 0,
        borderLeftWidth: compare && !suppressActiveColumnRule ? visibleLanguage === language ? 3 : 1 : 0,
        borderLeftColor: visibleLanguage === language ? colors.currentRule : colors.divider }}>
        {compare && <AppText variant="label">{t(visibleLanguage === language ? 'partList.readingColumn' : 'partList.comparisonColumn',
          { language: sampleLanguages.find(candidate => candidate.value === visibleLanguage)?.label ?? visibleLanguage })}</AppText>}
        <LiturgyText language={visibleLanguage} text={item.text[visibleLanguage]} readingSize={readingSize} compactStanzas tone={past ? 'muted' : 'default'} />
        {!item.text[visibleLanguage]?.trim() && readIn && alternatives.length > 0 && <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="muted">{t('partList.chooseAnother')}</AppText>
          {alternatives.map(value => <AppButton key={value} variant="secondary" onPress={() => readIn(value)}>
            {t('partList.readIn', { language: sampleLanguages.find(candidate => candidate.value === value)!.label })}
          </AppButton>)}
        </View>}
      </View>
      })}
    </View>
    </View>
  </SwipeablePart>
})
