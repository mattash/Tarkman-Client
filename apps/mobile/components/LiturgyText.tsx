import { useState } from 'react'
import { Linking, Platform, Text, View, useWindowDimensions } from 'react-native'
import { parseMarkdown, parseMarkdownBlocks, safeHttpsUrl, type TextRun } from '../design/markdown'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { readingSizes, spacing, type ReadingSize } from '../design/tokens'
import { AppText, type AppTextProps } from './AppText'
import { useI18n } from '../features/i18n'

export interface LiturgyTextProps extends Omit<AppTextProps, 'children'> { text: string | null | undefined; readingSize?: ReadingSize; compactStanzas?: boolean; blocks?: boolean }
export function LiturgyText({ text, selectable = true, language = 'en', tone = 'default', readingSize = 'standard', compactStanzas = false, blocks = false, variant = 'liturgy', style, ...props }: LiturgyTextProps) {
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
  const styledRuns = (runs: TextRun[]) => runs.map((run, index) => run.kind === 'plain' ? run.text :
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
        : { color: colors.primary, textDecorationLine: 'underline' }}>{run.text}</Text>)
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
    const stanzas = text!.replace(/\r\n?/g, '\n').split(/(\n[ \t]*\n(?:[ \t]*\n)*)/)
    return <View>{stanzas.map((stanza, index) => index % 2 === 0
      ? stanza.length > 0 ? <LiturgyText key={index} {...props} variant={variant} style={style} text={stanza} language={language} tone={tone} selectable={selectable} readingSize={readingSize} /> : null
      : <View key={index} style={{ height: spacing.stanza * fontScale * (readingSizes[readingSize].lineHeight / 38) * (stanza.split('\n').length - 2) }} />)}</View>
  }
  // Nested native Text preserves paragraph breaks and selection without a DOM renderer.
  return <><AppText {...props} variant={variant} style={[variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]} selectable={selectable} language={missing ? 'en' : language} tone={missing ? 'muted' : tone}>
    {missing ? t('liturgyText.translationUnavailable') : styledRuns(parseMarkdown(text!))}
  </AppText>{failureNotice}</>
}