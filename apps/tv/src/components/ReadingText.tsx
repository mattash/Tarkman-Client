import { Platform, Text, type TextStyle } from 'react-native'
import { parseMarkdown, type DisplayLanguage, type TextRun } from '@tarkman/reader'
import { colors } from '../theme'

// apps/mobile's LiturgyText faces: Source Serif 4 for reading text, Noto Serif Armenian for Classical
// Armenian, the platform italic, and inline Markdown runs. Links are shown, not followed: a TV has no browser.
const tags: Record<DisplayLanguage, string> = { en: 'en', grabar: 'hy', translit: 'hy-Latn', hyw: 'hy' }

export function ReadingText({ text, language, style, semibold = false }: { text: string; language: DisplayLanguage; style?: TextStyle | TextStyle[]; semibold?: boolean }) {
  const armenian = language === 'grabar'
  const family = armenian ? (semibold ? 'NotoSerifArmenian-Bold' : 'NotoSerifArmenian-Regular') : (semibold ? 'SourceSerif4-Semibold' : 'SourceSerif4-Regular')
  return (
    <Text accessibilityLanguage={tags[language]} style={[{ color: colors.textPrimary, fontFamily: family, fontWeight: '400' }, style]}>
      {parseMarkdown(text).map((run, index) => run.kind === 'plain' ? run.text : <Text key={index} style={runStyle(run, armenian)}>{run.text}</Text>)}
    </Text>
  )
}

function runStyle(run: TextRun, armenian: boolean): TextStyle {
  switch (run.kind) {
    case 'bold': return { fontFamily: armenian ? 'NotoSerifArmenian-Bold' : 'SourceSerif4-Semibold', fontWeight: '400' }
    case 'italic': return { fontFamily: Platform.OS === 'ios' ? 'System' : undefined, fontStyle: 'italic' }
    case 'code': return { backgroundColor: colors.surfaceRaised }
    default: return { color: colors.actionPrimary, textDecorationLine: 'underline' }
  }
}
