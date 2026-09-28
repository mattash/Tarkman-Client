import { projectionText, type LivePart } from '@tarkman/reader'
import type { Language } from '@tarkman/core'

/** A remote-focusable slice of a part: Up/Down on the remote moves one block at a time. */
export interface ReadingBlock { key: string; partKey: string; partIndex: number; blockIndex: number; text: string }
export interface ReadingPart { key: string; index: number; role: string; position: number; blocks: ReadingBlock[]; missing: boolean }

const MAX_BLOCK = 420

/** Paragraphs, then sentences, so a long passage never becomes one unscrollable block. */
export function splitText(text: string, max = MAX_BLOCK): string[] {
  const out: string[] = []
  for (const paragraph of text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)) {
    if (paragraph.length <= max) { out.push(paragraph); continue }
    let current = ''
    for (const sentence of paragraph.match(/[^.!?։:;\n]+[.!?։:;]*\s*|\n/g) ?? [paragraph]) {
      if (current && current.length + sentence.length > max) { out.push(current.trim()); current = '' }
      current += sentence
      while (current.length > max) { out.push(current.slice(0, max).trim()); current = current.slice(max) }
    }
    if (current.trim()) out.push(current.trim())
  }
  return out
}

/** Keys are the engine's occurrence-aware part keys, so repeated part IDs stay distinct. */
export function readingParts(parts: readonly LivePart[], language: Language): ReadingPart[] {
  return parts.map((part, index) => {
    const text = projectionText(part.text[language])
    const blocks = text ? splitText(text).map((slice, blockIndex) => ({ key: `${part.key}#${blockIndex}`, partKey: part.key, partIndex: index, blockIndex, text: slice })) : []
    return { key: part.key, index, role: part.role, position: part.position, blocks, missing: !text }
  })
}

/** Languages with text in at least one part, in the core order; English first when nothing has text. */
export function availableLanguages(parts: readonly LivePart[], order: readonly Language[]): Language[] {
  const present = order.filter(language => parts.some(part => projectionText(part.text[language])))
  return present.length ? present : ['en']
}
