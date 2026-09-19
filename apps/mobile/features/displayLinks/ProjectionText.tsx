import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { startProjectionScroll, type ProjectionClock } from './projectionTiming'

/** Keep large text within its own viewport while following the shared occurrence clock. */
export function ProjectionText({ text, language = 'en', fontSize, centered = false, clock, durationMs }: {
  text: string | null; language?: Language; fontSize: number; centered?: boolean; clock: ProjectionClock; durationMs: number
}) {
  const scroll = useRef<ScrollView>(null)
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(true)
  const { t } = useI18n()
  const lineHeight = fontSize * 1.45
  useEffect(() => {
    let mounted = true, receivedEvent = false
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !receivedEvent) setReducedMotion(value) }, () => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { receivedEvent = true; setReducedMotion(value) })
    return () => { mounted = false; subscription.remove() }
  }, [])
  useEffect(() => startProjectionScroll(clock, { content, viewport, lineHeight, duration: durationMs, reducedMotion },
    y => scroll.current?.scrollTo({ y, animated: false })), [clock, content, viewport, lineHeight, durationMs, reducedMotion])
  return <View style={styles.column}>
    <ScrollView ref={scroll} testID="projection-text-scroll" style={styles.column} showsVerticalScrollIndicator={false}
      onLayout={event => setViewport(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContent(height)}
      contentContainerStyle={{ flexGrow: 1, justifyContent: centered ? 'center' : 'flex-start', paddingBottom: spacing.sm }}>
      {text ? <LiturgyText text={text} language={language} style={{ fontSize, lineHeight, textAlign: centered ? 'center' : 'left' }} />
        : <AppText tone="muted" style={{ fontSize, lineHeight }}>{t('display.projectionNoText')}</AppText>}
    </ScrollView>
  </View>
}
const styles = StyleSheet.create({ column: { flex: 1, minHeight: 0, minWidth: 0 } })
