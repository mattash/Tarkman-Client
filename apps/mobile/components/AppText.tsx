import { Platform, Text, type TextProps } from 'react-native'
import type { Language } from '@tarkman/core'
import { useTheme } from '../design/ThemeProvider'
import { useReadingFont } from '../design/readingFont'
import { typography } from '../design/tokens'

export interface AppTextProps extends TextProps {
  variant?: keyof typeof typography
  language?: Language
  tone?: 'default' | 'muted' | 'accent' | 'destructive'
}
const languageTags = { en: 'en', ru: 'ru', grabar: 'hy', translit: 'hy-Latn' } as const
export function AppText({ variant = 'body', language = 'en', tone = 'default', style, ...props }: AppTextProps) {
  const { colors } = useTheme()
  const type = typography[variant]
  const fontReady = useReadingFont()
  const armenian = language === 'grabar' && fontReady
  return <Text {...props} allowFontScaling accessibilityLanguage={languageTags[language]}
    {...(Platform.OS === 'web' ? { lang: languageTags[language] } : {})}
    accessibilityRole={props.accessibilityRole ?? (variant === 'title' || variant === 'heading' ? 'header' : undefined)}
    style={[type, {
      color: tone === 'default' ? colors.foreground : tone === 'accent' ? colors.primary : colors[tone],
      fontFamily: armenian ? (type.fontWeight === '700' || type.fontWeight === '600' ? 'NotoSerifArmenian-Bold' : 'NotoSerifArmenian-Regular') : undefined,
      // Static font files carry their own weight. Never synthesize an Armenian weight.
      fontWeight: armenian ? '400' : type.fontWeight,
      flexShrink: 1,
    }, style]} />
}
