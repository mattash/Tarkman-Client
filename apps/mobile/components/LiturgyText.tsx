import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react'
import { Linking, Platform, Text, View, useWindowDimensions } from 'react-native'
import { parseMarkdown, parseMarkdownBlocks, safeHttpsUrl, type TextRun } from '../design/markdown'
import { parseMarkdownSource } from '../design/markdownSource'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { readingSizes, spacing, type ReadingSize } from '../design/tokens'
import { AppText, type AppTextProps } from './AppText'
import { useI18n } from '../features/i18n'

export interface PassageHighlight {
  start: number; end: number; requestId: number
  /** Called with the first highlighted glyph's window bounds (not the whole row). */
  onMeasure?(y: number, height: number, anchor: ComponentRef<typeof Text>): void
}
export interface LiturgyTextProps extends Omit<AppTextProps, 'children'> { text: string | null | undefined; readingSize?: ReadingSize; compactStanzas?: boolean; blocks?: boolean; passageHighlight?: PassageHighlight }
export function LiturgyText({ text, selectable = true, language = 'en', tone = 'default', readingSize = 'standard', compactStanzas = false, blocks = false, passageHighlight, variant = 'liturgy', style, ...props }: LiturgyTextProps) {
  const anchor = useRef<ComponentRef<typeof Text> | null>(null)
  const textFrame = useRef<ComponentRef<typeof View> | null>(null)
  const lineAnchor = useRef<{ y: number; height: number; request: PassageHighlight } | undefined>(undefined)
  const activeHighlight = useRef(passageHighlight)
  useLayoutEffect(() => {
    activeHighlight.current = passageHighlight
    return () => { activeHighlight.current = undefined }
  }, [passageHighlight])
  useEffect(() => {
    if (!passageHighlight) return
    // Nested native Text can finish layout after the row's onLayout/FlashList onLoad.
    // A bounded retry also accommodates fonts and FlashList's deferred initial positioning.
    const timers = [0, 80, 200, 450, 900, 1600].map(delay => setTimeout(() => {
      const node = anchor.current
      const report = (y: number, height: number) => {
        if (node && activeHighlight.current === passageHighlight && node === anchor.current && height > 0) {
          passageHighlight.onMeasure?.(y, height, node)
        }
      }
      // Native nested Text is a virtual node on some RN versions. onTextLayout
      // supplies exact line geometry when its own measureInWindow is unavailable.
      const line = lineAnchor.current
      if (Platform.OS !== 'web' && line?.request === passageHighlight) {
        textFrame.current?.measureInWindow?.((_x, y, width, height) => {
          if (width > 0 && height > 0) report(y + line.y, line.height)
        })
      } else node?.measureInWindow?.((_x, y, width, height) => {
        if (width > 0) report(y, height)
      })
    }, delay))
    return () => { timers.forEach(clearTimeout) }
  }, [passageHighlight, text, language, readingSize])
  // Keyed to the text it happened on, so a reused row showing another part does not carry the message over.
  const [failedText, setFailedText] = useState<string | null>(null)
  const linkFailed = failedText !== null && failedText === text
  const { colors } = useTheme()
  const { t } = useI18n()
  const { fontScale } = useWindowDimensions()
  const fontReady = useReadingFont()
  const missing = text == null || text.trim().length === 0
  const failureNotice = linkFailed && <AppText variant="caption" accessibilityRole="alert">{t('liturgyText.linkFailed')}</AppText>
  // One nested Text per inline form, shared by every paragraph-shaped block below.
  const styledRuns = (runs: TextRun[], source?: string) => {
    const ranges = passageHighlight && source !== undefined ? parseMarkdownSource(source).offsets.map(positions => {
      const start = positions.findIndex(position => position.end > passageHighlight.start && position.start < passageHighlight.end)
      if (start < 0) return undefined
      let end = start + 1
      while (end < positions.length && positions[end].start < passageHighlight.end) end++
      return [start, end] as const
    }) : []
    let anchored = false
    const content = (run: TextRun, index: number) => {
      const range = ranges[index]
      if (!range) return run.text
      const first = !anchored
      anchored = true
      // Anchor one code point: measuring an entire long match can produce a row-sized box.
      const anchorEnd = range[0] + (run.text.codePointAt(range[0])! > 0xffff ? 2 : 1)
      return <>{run.text.slice(0, range[0])}<Text testID={first ? 'passage-highlight-anchor' : 'passage-highlight'}
        ref={first ? anchor : undefined} style={{ backgroundColor: colors.subtle, color: colors.primary }}>
        {run.text.slice(range[0], first ? anchorEnd : range[1])}</Text>
        {first && anchorEnd < range[1] && <Text style={{ backgroundColor: colors.subtle, color: colors.primary }}>{run.text.slice(anchorEnd, range[1])}</Text>}
        {run.text.slice(range[1])}</>
    }
    return runs.map((run, index) => run.kind === 'plain' ? passageHighlight ? <Text key={index}>{content(run, index)}</Text> : run.text :
    <Text key={index} allowFontScaling
      {...(run.kind === 'link' && Platform.OS === 'web' ? { href: run.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {})} accessibilityRole={run.kind === 'link' ? 'link' : undefined}
      accessibilityLabel={run.kind === 'link' ? `${run.text} (${run.url})` : undefined}
      accessibilityHint={run.kind === 'link' ? t('liturgyText.linkHint') : undefined}
      onPress={run.kind === 'link' && Platform.OS !== 'web' ? () => {
        if (run.url && safeHttpsUrl(run.url)) Linking.openURL(run.url).catch(() => setFailedText(text ?? null))
      } : undefined}
      style={run.kind === 'bold'
        ? language === 'grabar' && fontReady ? { fontFamily: 'NotoSerifArmenian-Bold', fontWeight: '400' }
          : fontReady ? { fontFamily: 'SourceSerif4-Semibold', fontWeight: '400' } : { fontWeight: '600' }
        : run.kind === 'italic' ? {
          // No pinned literary italic ships yet. Use the platform's real
          // italic face rather than synthesizing one from Source Serif.
          fontFamily: Platform.OS === 'ios' ? 'System' : Platform.OS === 'android' ? 'sans-serif' : 'system-ui',
          fontStyle: 'italic',
        }
        : run.kind === 'code' ? { backgroundColor: colors.subtle }
        : { color: colors.primary, textDecorationLine: 'underline' }}>{content(run, index)}</Text>)
  }
  // Authored explanation Markdown renders the agreed block subset through these same primitives, so
  // text scaling, selection, the reading font and link handling still apply to every block.
  if (blocks && !missing) {
    const parsed = parseMarkdownBlocks(text!)
    if (parsed.length > 1 || parsed[0].kind !== 'paragraph') {
      // Paragraph-shaped blocks share the reading variant's size choice; headings keep their own
      // variant sizes. The h1 cap keeps it above the uncapped body at the OS maximum: body 17pt can
      // reach about 3.1× (53pt), so 23pt at 2.4× (55pt) stays the largest text on screen.
      const bodyStyle = [variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]
      return <View style={{ gap: spacing.md }}>
        {parsed.map((block, index) => {
          if (block.kind === 'heading') return <AppText key={index} {...props} accessibilityRole="header"
            // The app distinguishes three in-text heading sizes; the explanation title is a heading of its own.
            variant={block.level === 1 ? 'heading' : block.level === 2 ? 'rowTitle' : 'label'}
            maxFontSizeMultiplier={block.level === 1 ? 2.4 : undefined}
            selectable={selectable} language={language} tone={tone} style={style}>{styledRuns(block.runs)}</AppText>
          if (block.kind === 'list') return <View key={index} style={{ gap: spacing.xs }}>
            {block.items.map((item, itemIndex) => <View key={itemIndex} style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <AppText {...props} variant={variant} selectable={false} language={language} tone="muted"
                style={[...bodyStyle, { minWidth: 22, textAlign: 'right' }]}>{block.ordered ? `${block.start + itemIndex}.` : '•'}</AppText>
              <AppText {...props} variant={variant} selectable={selectable} language={language} tone={tone}
                style={[...bodyStyle, { flex: 1 }]}>{styledRuns(item)}</AppText>
            </View>)}
          </View>
          if (block.kind === 'quote') return <View key={index} style={{ borderLeftWidth: 2, borderLeftColor: colors.divider, paddingLeft: spacing.md }}>
            <AppText {...props} variant={variant} selectable={selectable} language={language} tone={tone} style={bodyStyle}>{styledRuns(block.runs)}</AppText>
          </View>
          return <AppText key={index} {...props} variant={variant} selectable={selectable} language={language} tone={tone} style={bodyStyle}>{styledRuns(block.runs)}</AppText>
        })}
        {failureNotice}
      </View>
    }
  }
  if (compactStanzas && !missing && !text!.includes('```') && /\n\s*\n/.test(text!)) {
    // Keep authored line breaks inside each selectable stanza. Blank lines become
    // proportional space between stanzas instead of a full empty line between them.
    // Do not backtrack one CRLF into two separate line breaks; offsets stay raw.
    const stanzas = text!.split(/((?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r(?!\n)|\n)(?:[ \t]*(?:\r\n|\r(?!\n)|\n))*)/)
    let sourceOffset = 0
    const starts: number[] = []
    for (const stanza of stanzas) { starts.push(sourceOffset); sourceOffset += stanza.length }
    const firstMatch = passageHighlight ? stanzas.findIndex((stanza, index) => index % 2 === 0
      && passageHighlight.end > starts[index] && passageHighlight.start < starts[index] + stanza.length) : -1
    return <View>{stanzas.map((stanza, index) => {
      const start = starts[index]
      const localHighlight = index % 2 === 0 && passageHighlight && passageHighlight.end > start && passageHighlight.start < start + stanza.length
        ? { ...passageHighlight, onMeasure: index === firstMatch ? passageHighlight.onMeasure : undefined, start: Math.max(0, passageHighlight.start - start), end: Math.min(stanza.length, passageHighlight.end - start) } : undefined
      return index % 2 === 0
        ? stanza.length > 0 ? <LiturgyText key={index} {...props} variant={variant} style={style} text={stanza} language={language} tone={tone} selectable={selectable} readingSize={readingSize} passageHighlight={localHighlight} /> : null
        : <View key={index} style={{ height: spacing.stanza * fontScale * (readingSizes[readingSize].lineHeight / 38) * (stanza.replace(/\r\n?/g, '\n').split('\n').length - 2) }} />
    })}</View>
  }
  // Nested native Text preserves paragraph breaks and selection without a DOM renderer.
  const body = <><AppText {...props} onTextLayout={passageHighlight ? event => {
    props.onTextLayout?.(event)
    const mapped = parseMarkdownSource(text ?? '')
    let selectedOffset = 0
    let found = false
    for (const positions of mapped.offsets) {
      const local = positions.findIndex(position => position.end > passageHighlight.start && position.start < passageHighlight.end)
      if (local >= 0) { selectedOffset += local; found = true; break }
      selectedOffset += positions.length
    }
    if (!found) return
    const displayed = mapped.runs.map(run => run.text).join('')
    let offset = 0
    for (const line of event.nativeEvent.lines) {
      const start = displayed.indexOf(line.text, offset)
      const end = (start < 0 ? offset : start) + line.text.length
      if (selectedOffset < end) {
        lineAnchor.current = { y: line.y, height: line.height, request: passageHighlight }
        break
      }
      offset = end
    }
  } : props.onTextLayout} variant={variant} style={[variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]} selectable={selectable} language={missing ? 'en' : language} tone={missing ? 'muted' : tone}>
    {missing ? t('liturgyText.translationUnavailable') : styledRuns(parseMarkdown(text!), text!)}
  </AppText>{failureNotice}</>
  return passageHighlight ? <View ref={textFrame} collapsable={false}>{body}</View> : body
}