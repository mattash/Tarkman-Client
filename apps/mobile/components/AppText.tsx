import { Platform, Text, useWindowDimensions, type TextProps } from 'react-native'
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
  const { fontScale } = useWindowDimensions()
  const armenian = language === 'grabar' && fontReady
  const literary = (variant === 'title' || variant === 'heading' || variant === 'liturgy' || variant === 'explanation') && fontReady
  const semibold = variant === 'title' || variant === 'heading'
  // This React Native/iOS runtime keeps old text frames when the content-size
  // category changes behind a presented sheet. Refresh only the native Text
  // leaf; parent controls, inputs, lists, scroll position and reader state stay mounted.
  return <Text key={Platform.OS === 'ios' ? fontScale : 'native'} {...props} allowFontScaling accessibilityLanguage={languageTags[language]}
    {...(Platform.OS === 'web' ? { lang: languageTags[language] } : {})}
    accessibilityRole={props.accessibilityRole ?? (variant === 'title' || variant === 'heading' ? 'header' : undefined)}
    style={[type, {
      color: tone === 'default' ? colors.foreground : tone === 'accent' ? colors.primary : colors[tone],
      fontFamily: armenian ? (semibold ? 'NotoSerifArmenian-Bold' : 'NotoSerifArmenian-Regular')
        : literary ? (semibold ? 'SourceSerif4-Semibold' : 'SourceSerif4-Regular') : undefined,
      // Static reading files carry their own weight. Controls remain platform sans.
      fontWeight: armenian || literary ? '400' : type.fontWeight,
      flexShrink: 1,
    }, style]} />
}
