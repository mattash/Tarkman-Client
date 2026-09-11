import { useState } from 'react'
import { Linking, Platform, Text } from 'react-native'
import { parseMarkdown, safeHttpsUrl } from '../design/markdown'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { AppText, type AppTextProps } from './AppText'

export interface LiturgyTextProps extends Omit<AppTextProps, 'children'> { text: string | null | undefined }
export function LiturgyText({ text, selectable = true, language = 'en', tone = 'default', ...props }: LiturgyTextProps) {
  const [linkFailed, setLinkFailed] = useState(false)
  const { colors } = useTheme()
  const fontReady = useReadingFont()
  const missing = text == null || text.trim().length === 0
  // Nested native Text preserves paragraph breaks and selection without a DOM renderer.
  return <><AppText {...props} variant="liturgy" selectable={selectable} language={missing ? 'en' : language} tone={missing ? 'muted' : tone}>
    {missing ? 'Translation not available.' : parseMarkdown(text!).map((run, index) => run.kind === 'plain' ? run.text :
      <Text key={index} allowFontScaling
        {...(run.kind === 'link' && Platform.OS === 'web' ? { href: run.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {})} accessibilityRole={run.kind === 'link' ? 'link' : undefined}
        accessibilityLabel={run.kind === 'link' ? `${run.text} (${run.url})` : undefined}
        accessibilityHint={run.kind === 'link' ? 'Opens an HTTPS website in your browser' : undefined}
        onPress={run.kind === 'link' && Platform.OS !== 'web' ? () => {
          if (run.url && safeHttpsUrl(run.url)) Linking.openURL(run.url).catch(() => setLinkFailed(true))
        } : undefined}
        style={run.kind === 'bold' ? (language === 'grabar' && fontReady ? { fontFamily: 'NotoSerifArmenian-Bold', fontWeight: '400' } : { fontWeight: '700' })
          : run.kind === 'italic' ? { fontStyle: 'italic' } : run.kind === 'code' ? { backgroundColor: colors.subtle }
          : { color: colors.primary, textDecorationLine: 'underline' }}>{run.text}</Text>)}
  </AppText>{linkFailed && <AppText variant="caption" accessibilityRole="alert">Could not open the link. Try the link again.</AppText>}</>
}
