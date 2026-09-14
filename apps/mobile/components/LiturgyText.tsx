import { useState } from 'react'
import { Linking, Platform, Text, View, useWindowDimensions } from 'react-native'
import { parseMarkdown, safeHttpsUrl } from '../design/markdown'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { readingSizes, spacing, type ReadingSize } from '../design/tokens'
import { AppText, type AppTextProps } from './AppText'

export interface LiturgyTextProps extends Omit<AppTextProps, 'children'> { text: string | null | undefined; readingSize?: ReadingSize; compactStanzas?: boolean }
export function LiturgyText({ text, selectable = true, language = 'en', tone = 'default', readingSize = 'standard', compactStanzas = false, variant = 'liturgy', style, ...props }: LiturgyTextProps) {
  // Keyed to the text it happened on, so a reused row showing another part does not carry the message over.
  const [failedText, setFailedText] = useState<string | null>(null)
  const linkFailed = failedText !== null && failedText === text
  const { colors } = useTheme()
  const { fontScale } = useWindowDimensions()
  const fontReady = useReadingFont()
  const missing = text == null || text.trim().length === 0
  if (compactStanzas && !missing && !text!.includes('```') && /\n\s*\n/.test(text!)) {
    // Keep authored line breaks inside each selectable stanza. Blank lines become
    // proportional space between stanzas instead of a full empty reading line.
    const stanzas = text!.replace(/\r\n?/g, '\n').split(/(\n[ \t]*\n(?:[ \t]*\n)*)/)
    return <View>{stanzas.map((stanza, index) => index % 2 === 0
      ? stanza.length > 0 ? <LiturgyText key={index} {...props} variant={variant} style={style} text={stanza} language={language} tone={tone} selectable={selectable} readingSize={readingSize} /> : null
      : <View key={index} style={{ height: spacing.stanza * fontScale * (readingSizes[readingSize].lineHeight / 38) * (stanza.split('\n').length - 2) }} />)}</View>
  }
  // Nested native Text preserves paragraph breaks and selection without a DOM renderer.
  return <><AppText {...props} variant={variant} style={[variant === 'liturgy' ? readingSizes[readingSize] : undefined, style]} selectable={selectable} language={missing ? 'en' : language} tone={missing ? 'muted' : tone}>
    {missing ? 'Translation not available.' : parseMarkdown(text!).map((run, index) => run.kind === 'plain' ? run.text :
      <Text key={index} allowFontScaling
        {...(run.kind === 'link' && Platform.OS === 'web' ? { href: run.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {})} accessibilityRole={run.kind === 'link' ? 'link' : undefined}
        accessibilityLabel={run.kind === 'link' ? `${run.text} (${run.url})` : undefined}
        accessibilityHint={run.kind === 'link' ? 'Opens an HTTPS website in your browser' : undefined}
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
          : { color: colors.primary, textDecorationLine: 'underline' }}>{run.text}</Text>)}
  </AppText>{linkFailed && <AppText variant="caption" accessibilityRole="alert">Could not open the link. Try the link again.</AppText>}</>
}
