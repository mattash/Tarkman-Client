import { useEffect, useId, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text } from 'react-native'
import { startProjectionScroll, type ContinuousGroup, type DisplayLanguage, type ManualPosition, type PageGroup, type ProjectionClock, type TextMovement } from '@tarkman/reader'
import { useI18n } from '../i18n'
import { ReadingText } from './ReadingText'
import { colors, space } from '../theme'

export interface ScrollMetrics { maximum: number; viewport: number }

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
  const [holdFraction, setHoldFraction] = useState<number | undefined>(undefined)
  const [pageCount, setPageCount] = useState<number | undefined>(undefined)
  const [reducedMotion, setReducedMotion] = useState(true)
  const lineHeight = fontSize * 1.45
  useEffect(() => {
    let mounted = true, receivedEvent = false
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !receivedEvent) setReducedMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { receivedEvent = true; setReducedMotion(value) })
    return () => { mounted = false; subscription.remove() }
  }, [])
  const maximum = Math.max(0, content - viewport)
  useEffect(() => { onMetrics?.({ maximum, viewport }) }, [onMetrics, maximum, viewport])
  useEffect(() => continuousGroup?.subscribe(setHoldFraction), [continuousGroup])
  useEffect(() => continuousGroup?.report(id, text ? content : 0, text && content <= 0 ? 0 : viewport), [continuousGroup, id, text, content, viewport])
  useEffect(() => pageGroup?.subscribe(setPageCount), [pageGroup])
  useEffect(() => {
    const step = Math.max(1, viewport - Math.min(lineHeight * 2, viewport / 2))
    return pageGroup?.report(id, viewport > 0 ? Math.ceil(maximum / step) + 1 : 1)
  }, [id, pageGroup, maximum, viewport, lineHeight])
  useEffect(() => {
    if (movement === 'none') { scroll.current?.scrollTo({ y: 0, animated: false }); return }
    if (movement === 'manual') {
      const update = (progress: number) => scroll.current?.scrollTo({ y: maximum * progress, animated: true })
      update(manualPosition?.get() ?? 0)
      return manualPosition?.subscribe(update)
    }
    const continuous = movement === 'continuous' && !reducedMotion ? continuousGroup : undefined
    if (continuous && holdFraction === undefined) return
    return startProjectionScroll(clock, { content: text ? content : 0, viewport, lineHeight, duration: continuous?.duration(durationMs) ?? durationMs, holdFraction: continuous ? holdFraction : undefined,
      reducedMotion: movement === 'paged' || reducedMotion, pageCount: pageGroup ? pageCount : undefined },
    y => {
      if (y > 0) continuous?.start(durationMs)
      scroll.current?.scrollTo({ y, animated: false })
    })
  }, [clock, content, viewport, lineHeight, durationMs, reducedMotion, movement, manualPosition, maximum, pageGroup, pageCount, continuousGroup, holdFraction, text])
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
