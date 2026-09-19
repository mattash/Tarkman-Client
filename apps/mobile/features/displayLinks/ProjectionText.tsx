import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'

export const PROJECTION_ADVANCE_MS = 14000

/** Keep the text large. Long readings advance by a viewport with two lines of overlap. */
export function ProjectionText({ text, language = 'en', fontSize, centered = false }: {
  text: string | null; language?: Language; fontSize: number; centered?: boolean
}) {
  const scroll = useRef<ScrollView>(null)
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const { colors } = useTheme()
  const { t } = useI18n()
  const lineHeight = fontSize * 1.45
  const overflowing = content > viewport + 2 && viewport > 0
  useEffect(() => {
    let y = 0
    scroll.current?.scrollTo({ y, animated: false })
    if (!overflowing) return
    const timer = setInterval(() => {
      y = y >= content - viewport - 2 ? 0 : Math.min(content - viewport, y + Math.max(lineHeight, viewport - lineHeight * 2))
      // Instant paging also respects reduced-motion users and avoids a moving projection.
      scroll.current?.scrollTo({ y, animated: false })
    }, PROJECTION_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [text, content, viewport, lineHeight, overflowing])
  return <View style={styles.column}>
    <ScrollView ref={scroll} testID="projection-text-scroll" style={styles.column} showsVerticalScrollIndicator={false}
      onLayout={event => setViewport(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContent(height)}
      contentContainerStyle={{ flexGrow: 1, justifyContent: centered ? 'center' : 'flex-start', paddingBottom: spacing.sm }}>
      {text ? <LiturgyText text={text} language={language} style={{ fontSize, lineHeight, textAlign: centered ? 'center' : 'left' }} />
        : <AppText tone="muted" style={{ fontSize, lineHeight }}>{t('display.projectionNoText')}</AppText>}
    </ScrollView>
    {overflowing && <AppText variant="caption" style={{ color: colors.muted, paddingTop: spacing.sm }}>{t('display.autoAdvance')}</AppText>}
  </View>
}
const styles = StyleSheet.create({ column: { flex: 1, minHeight: 0, minWidth: 0 } })
