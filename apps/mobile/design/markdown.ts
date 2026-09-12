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
