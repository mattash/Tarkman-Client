// Content helpers shared by every reader surface (mobile displays, Apple TV).

/** Older Rails variable readings contain rendered HTML. Convert to inert text, never inject markup. */
export function projectionText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match
    }).trim() || null
}

// Inline Markdown in authored liturgy text. Pure parsing; each app renders the runs.
export interface TextRun { text: string; kind: 'plain' | 'bold' | 'italic' | 'code' | 'link'; url?: string }
export function safeHttpsUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- Reject control characters in URLs.
  if (!/^https:\/\//i.test(value) || /[\s\\<>\u0000-\u001f\u007f]/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
  } catch { return false }
}
// Bounded inline grammar: no nesting, block syntax, HTML interpretation or URL autolinking.
export function parseMarkdown(source: string): TextRun[] {
  // Authored text arrives with Windows line endings; normalise so paragraphs break once, not twice.
  const text = source.replace(/\r\n?/g, '\n')
  const runs: TextRun[] = []
  const plain = (value: string) => {
    const previous = runs[runs.length - 1]
    if (previous?.kind === 'plain') previous.text += value
    else runs.push({ kind: 'plain', text: value })
  }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const escaped = /^\\([\\`*_[\]()!<>#~])/.exec(rest)
    if (escaped) { plain(escaped[1]); i += escaped[0].length; continue }
    // Consume unsupported HTML and image syntax whole so their contents stay inert.
    const inert = /^(?:```[\s\S]*?(?:```|$)|<[^>\n]*>|!\[[^\]\n]*\]\([^\n]*?\))/.exec(rest)
    if (inert) { plain(inert[0]); i += inert[0].length; continue }
    const link = /^\[([^\]\n]*)\]\(([^\n]*?)\)/.exec(rest)
    if (link) {
      if (!/[\x5b\\*`]/.test(link[1]) && !/[()]/.test(link[2]) && safeHttpsUrl(link[2])) runs.push({ kind: 'link', text: link[1], url: link[2] })
      else plain(link[0])
      i += link[0].length; continue
    }
    // Emphasis only pairs when it opens before non-space and closes after non-space, so an unpaired
    // asterisk stays literal instead of italicising the text up to the next one.
    const formatted = /^(\*\*([^*\n\\\s](?:[^*\n\\]*[^*\n\\\s])?)\*\*|\*([^*\n\\\s](?:[^*\n\\]*[^*\n\\\s])?)\*|`([^`\n]+)`)/.exec(rest)
    if (formatted && text[i - 1] !== '*' && text[i + formatted[0].length] !== '*') {
      runs.push({ kind: formatted[2] ? 'bold' : formatted[3] ? 'italic' : 'code', text: formatted[2] ?? formatted[3] ?? formatted[4] })
      i += formatted[0].length; continue
    }
    plain(text[i]); i++
  }
  return runs
}

// The agreed block layer (mattash/Tarkman#421): paragraphs, ATX headings, unordered and ordered
// lists, and block quotes, with the inline forms above inside every block. Tables, footnotes, raw
// HTML, images and fenced regions stay literal, as they do in the inline grammar; the Vite site
// renders this same subset through react-markdown.
export type MarkdownBlock =
  | { kind: 'paragraph'; runs: TextRun[] }
  | { kind: 'heading'; level: 1 | 2 | 3; runs: TextRun[] }
  | { kind: 'list'; ordered: boolean; start: number; items: TextRun[][] }
  | { kind: 'quote'; runs: TextRun[] }

const HEADING = /^(#{1,6})[ \t]+(.*)$/
const BULLET = /^[-*+][ \t]+(.*)$/
const ORDERED = /^(\d{1,9})[.)][ \t]+(.*)$/
const QUOTE = /^>[ \t]?(.*)$/
const FENCE = /^```/

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().length === 0) { i += 1; continue }
    if (FENCE.test(line)) {
      // Fenced regions are not part of the subset: their lines join one literal paragraph, so the
      // block markers inside never classify and the inline grammar's inert rule keeps them whole.
      const fenced = [line]
      i += 1
      while (i < lines.length && !FENCE.test(lines[i])) { fenced.push(lines[i]); i += 1 }
      if (i < lines.length) { fenced.push(lines[i]); i += 1 }
      blocks.push({ kind: 'paragraph', runs: parseMarkdown(fenced.join('\n')) })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      // The app distinguishes three heading sizes; deeper authored levels fold into the smallest.
      blocks.push({ kind: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, runs: parseMarkdown(heading[2].trim()) })
      i += 1
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote) {
      const quoted: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) { quoted.push(QUOTE.exec(lines[i])![1]); i += 1 }
      blocks.push({ kind: 'quote', runs: parseMarkdown(quoted.join('\n')) })
      continue
    }
    const bullet = BULLET.exec(line), ordered = ORDERED.exec(line)
    if (bullet || ordered) {
      const isOrdered = !!ordered
      const items: TextRun[][] = []
      let start = 0
      while (i < lines.length) {
        const item = isOrdered ? ORDERED.exec(lines[i]) : BULLET.exec(lines[i])
        if (!item) break
        if (items.length === 0 && isOrdered) start = Number(item[1])
        items.push(parseMarkdown(item[isOrdered ? 2 : 1].trim()))
        i += 1
      }
      // Items are renumbered from the first marker, as an HTML list does.
      blocks.push({ kind: 'list', ordered: isOrdered, start: isOrdered ? start : 0, items })
      continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim().length > 0
      && !(FENCE.test(lines[i]) || HEADING.test(lines[i]) || BULLET.test(lines[i]) || ORDERED.test(lines[i]) || QUOTE.test(lines[i]))) { paragraph.push(lines[i]); i += 1 }
    blocks.push({ kind: 'paragraph', runs: parseMarkdown(paragraph.join('\n')) })
  }
  return blocks
}
