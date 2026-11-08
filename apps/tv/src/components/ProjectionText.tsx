import { useEffect, useId, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text } from 'react-native'
import { startProjectionScroll, type ContinuousGroup, type DisplayLanguage, type ManualPosition, type PageGroup, type ProjectionClock, type TextMovement } from '@tarkman/reader'
import { useI18n } from '../i18n'
import { ReadingText } from './ReadingText'
import { colors, space } from '../theme'

export interface ScrollMetrics { maximum: number; viewport: number; progress: number }

/**
 * apps/mobile's ProjectionText for tvOS: the same shared occurrence clock, timing, page groups and manual
 * position. The viewer scrolls with the remote (through the manual position), never by touch.
 */
export function ProjectionText({ text, language = 'en', fontSize, centered = false, clock, durationMs, movement = 'continuous', manualPosition, pageGroup, continuousGroup, onMetrics }: {
  text: string | null; language?: DisplayLanguage; fontSize: number; centered?: boolean; clock: ProjectionClock; durationMs: number
  movement?: TextMovement; manualPosition?: ManualPosition; pageGroup?: PageGroup; continuousGroup?: ContinuousGroup; onMetrics?(metrics: ScrollMetrics): void
}) {
  const { t } = useI18n()
  const scroll = useRef<ScrollView>(null)
  const id = useId()
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [pageCount, setPageCount] = useState<number | undefined>(undefined)
  const [reducedMotion, setReducedMotion] = useState(true)
  const lineHeight = fontSize * 1.45
  useEffect(() => {
    let mounted = true, receivedEvent = false
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !receivedEvent) setReducedMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { receivedEvent = true; setReducedMotion(value) })
    return () => { mounted = false; subscription.remove() }
  }, [])
  // The missing-text placeholder is not reading geometry, even if it overflows at large text sizes.
  const readingContent = text ? content : 0
  const maximum = Math.max(0, readingContent - viewport)
  const offset = useRef(0)
  const metricsCallback = useRef(onMetrics)
  useEffect(() => { metricsCallback.current = onMetrics }, [onMetrics])
  useEffect(() => { onMetrics?.({ maximum, viewport, progress: maximum > 0 ? Math.min(1, offset.current / maximum) : 0 }) }, [onMetrics, maximum, viewport])
  useEffect(() => { continuousGroup?.setGeometry(id, readingContent, text && content <= 0 ? 0 : viewport) }, [continuousGroup, id, text, readingContent, content, viewport])
  useEffect(() => () => continuousGroup?.remove(id), [continuousGroup, id])
  useEffect(() => pageGroup?.subscribe(setPageCount), [pageGroup])
  useEffect(() => {
    const step = Math.max(1, viewport - Math.min(lineHeight * 2, viewport / 2))
    return pageGroup?.report(id, viewport > 0 ? Math.ceil(maximum / step) + 1 : 1)
  }, [id, pageGroup, maximum, viewport, lineHeight])
  useEffect(() => {
    const scrollTo = (y: number, animated = false) => {
      offset.current = Math.max(0, Math.min(maximum, y))
      scroll.current?.scrollTo({ y: offset.current, animated })
      metricsCallback.current?.({ maximum, viewport, progress: maximum > 0 ? offset.current / maximum : 0 })
    }
    if (movement === 'none') { scrollTo(0); return }
    if (movement === 'manual') {
      const update = (progress: number) => scrollTo(maximum * progress, true)
      update(manualPosition?.get() ?? 0)
      return manualPosition?.subscribe(update)
    }
    return startProjectionScroll(clock, { content: readingContent, viewport, lineHeight, duration: durationMs,
      continuousGroup: movement === 'continuous' && !reducedMotion ? continuousGroup : undefined,
      reducedMotion: movement === 'paged' || reducedMotion, pageCount: pageGroup ? pageCount : undefined }, scrollTo)
  }, [clock, readingContent, viewport, lineHeight, durationMs, reducedMotion, movement, manualPosition, maximum, pageGroup, pageCount, continuousGroup])
  return (
    <ScrollView ref={scroll} testID="projection-text-scroll" style={styles.column} scrollEnabled={false} showsVerticalScrollIndicator={movement === 'manual'}
      onLayout={event => setViewport(event.nativeEvent.layout.height)} onContentSizeChange={(_width, height) => setContent(height)}
      contentContainerStyle={{ flexGrow: 1, justifyContent: centered ? 'center' : 'flex-start', paddingBottom: space.sm }}>
      {text ? <ReadingText text={text} language={language} style={{ fontSize, lineHeight, textAlign: centered ? 'center' : 'left' }} />
        : <Text style={[styles.muted, { fontSize, lineHeight }]}>{t('display.projectionNoText')}</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  column: { flex: 1, minHeight: 0, minWidth: 0 },
  muted: { color: colors.textSecondary },
})
