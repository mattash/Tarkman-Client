import type { Language } from '@tarkman/core'
import { AppText, type AppTextProps } from '../../components/AppText'
import { parseMarkdown } from '../../design/markdown'
import type { LivePart } from '../live/contracts'

/** The language a preview of this part is taken from: the reading language, else the first chosen language the part has. */
export function previewLanguage(part: LivePart, language: Language, selected: readonly Language[]): Language | undefined {
  return [language, ...selected].find(item => part.text[item]?.trim())
}

/** The beginning of a part's text as one plain run: markup dropped, line breaks joined, so a role alone is never all an operator sees. */
export function openingText(part: LivePart, language: Language, selected: readonly Language[]): string {
  const source = previewLanguage(part, language, selected)
  if (!source) return ''
  return parseMarkdown(part.text[source]!).map(run => run.text).join('').replace(/\s+/g, ' ').trim()
}

/** A muted preview of how a part begins, tagged with its language so VoiceOver reads it in the right voice. */
export function OpeningLine({ part, language, selected, numberOfLines, ...props }: Omit<AppTextProps, 'children' | 'language'> & {
  part: LivePart; language: Language; selected: readonly Language[]; numberOfLines: number
}) {
  const text = openingText(part, language, selected)
  if (!text) return null
  return <AppText variant="caption" tone="muted" {...props} language={previewLanguage(part, language, selected)} numberOfLines={numberOfLines}>{text}</AppText>
}
