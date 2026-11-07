import { useEffect, useId, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { startProjectionScroll, type ContinuousGroup, type ProjectionClock } from './projectionTiming'
import type { TextMovement, ManualPosition, PageGroup } from './customization'

/** Keep large text within its own viewport while following the shared occurrence clock. */
export function ProjectionText({ text, language = 'en', fontSize, centered = false, clock, durationMs, movement = 'continuous', manualPosition, pageGroup, continuousGroup, preview = false }: {
  text: string | null; language?: Language; fontSize: number; centered?: boolean; clock: ProjectionClock; durationMs: number
  movement?: TextMovement; manualPosition?: ManualPosition; pageGroup?: PageGroup; continuousGroup?: ContinuousGroup; preview?: boolean
}) {
  const scroll = useRef<ScrollView>(null)
  const id = useId()
  const localPosition = useRef(0), expectedY = useRef<number | null>(null)
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [pageCount, setPageCount] = useState<number | undefined>(undefined)
  const [reducedMotion, setReducedMotion] = useState(true)
  const { t } = useI18n()
  const lineHeight = fontSize * 1.45
  useEffect(() => {
    let mounted = true, receivedEvent = false
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !receivedEvent) setReducedMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { receivedEvent = true; setReducedMotion(value) })
    return () => { mounted = false; subscription.remove() }
  }, [])
  const effectiveContent = text ? content : 0
  const maximum = Math.max(0, effectiveContent - viewport)
  useEffect(() => {
    continuousGroup?.setGeometry(id, effectiveContent, text && content <= 0 ? 0 : viewport)
  }, [continuousGroup, id, text, content, viewport, effectiveContent])
  useEffect(() => () => continuousGroup?.remove(id), [continuousGroup, id])
  useEffect(() => pageGroup?.subscribe(setPageCount), [pageGroup])
  useEffect(() => {
    const step = Math.max(1, viewport - Math.min(lineHeight * 2, viewport / 2))
    return pageGroup?.report(id, viewport > 0 ? Math.ceil(maximum / step) + 1 : 1)
  }, [id, pageGroup, maximum, viewport, lineHeight])
  useEffect(() => {
    if (movement === 'none') { scroll.current?.scrollTo({ y: 0, animated: false }); return }
    if (movement === 'manual') {
      const update = (progress: number) => {
        localPosition.current = progress
        expectedY.current = maximum * progress
        scroll.current?.scrollTo({ y: expectedY.current, animated: false })
      }
      update(manualPosition?.get() ?? localPosition.current)
      return manualPosition?.subscribe(update)
    }
    return startProjectionScroll(clock, { content: effectiveContent, viewport, lineHeight, duration: durationMs,
      continuousGroup: movement === 'continuous' && !reducedMotion ? continuousGroup : undefined,
      reducedMotion: movement === 'paged' || reducedMotion, pageCount: pageGroup ? pageCount : undefined },
    y => scroll.current?.scrollTo({ y, animated: false }))
  }, [clock, effectiveContent, viewport, lineHeight, durationMs, reducedMotion, movement, manualPosition, maximum, pageGroup, pageCount, continuousGroup])
  return <View style={styles.column}>
    <ScrollView ref={scroll} testID="projection-text-scroll" style={styles.column} showsVerticalScrollIndicator={movement === 'manual'}
      scrollEnabled={movement === 'manual'} scrollEventThrottle={32}
      onScroll={event => {
        if (movement !== 'manual' || maximum <= 0) return
        const y = event.nativeEvent.contentOffset.y
        if (expectedY.current !== null && Math.abs(y - expectedY.current) < 1) { expectedY.current = null; return }
        expectedY.current = null
        localPosition.current = Math.max(0, Math.min(1, y / maximum))
        manualPosition?.set(localPosition.current)
      }}
      onLayout={event => setViewport(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContent(height)}
      contentContainerStyle={{ flexGrow: 1, justifyContent: centered ? 'center' : 'flex-start', paddingBottom: spacing.sm }}>
      {text ? <LiturgyText text={text} language={language} style={{ fontSize, lineHeight, textAlign: centered ? 'center' : 'left' }} />
        : <AppText tone="muted" style={{ fontSize, lineHeight }}>{t('display.projectionNoText')}</AppText>}
    </ScrollView>
    {preview && movement === 'none' && maximum > 2 && <AppText accessibilityRole="alert" style={{ fontSize: 18, lineHeight: 24 }}>
      {t('display.previewOverflow')}
    </AppText>}
  </View>
}
const styles = StyleSheet.create({ column: { flex: 1, minHeight: 0, minWidth: 0 } })
