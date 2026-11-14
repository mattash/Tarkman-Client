import { parseMarkdown, type TextRun } from './markdown'

export interface SourceOffset { start: number; end: number }

/** Existing Markdown runs plus raw UTF-16 source intervals for each displayed code unit.
 * Parsing remains owned by parseMarkdown; this adapter only aligns its output to source.
 */
export function parseMarkdownSource(source: string): { runs: TextRun[]; offsets: SourceOffset[][] } {
  const runs = parseMarkdown(source)
  const offsets: SourceOffset[][] = []
  let cursor = 0
  for (const run of runs) {
    const positions: SourceOffset[] = []
    if (run.kind !== 'plain') {
      // A formatted run's displayed label is contiguous in source; skip its complete
      // wrapper afterwards so a subsequent repeated word cannot land in a link URL.
      const start = source.indexOf(run.text, cursor + (run.kind === 'bold' ? 2 : 1))
      for (let i = 0; i < run.text.length; i++) positions.push({ start: start + i, end: start + i + 1 })
      cursor = start + run.text.length
      if (run.kind === 'link') cursor += (run.url?.length ?? 0) + 3
      else cursor += run.kind === 'bold' ? 2 : 1
    } else {
      let output = 0
      while (output < run.text.length && cursor < source.length) {
        // Inert syntax is emitted verbatim by the parser, including backslashes.
        // Match its already-parsed output rather than interpreting its contents.
        const inert = /^(?:```[\s\S]*?(?:```|$)|<[^>\r\n]*>|!?\[[^\]\r\n]*\]\([^\r\n]*?\))/.exec(source.slice(cursor))?.[0]
        if (inert && run.text.startsWith(inert.replace(/\r\n?/g, '\n'), output)) {
          const end = cursor + inert.length
          while (cursor < end) {
            const start = cursor++
            if (source[start] === '\r' && source[cursor] === '\n') cursor++
            positions.push({ start, end: cursor }); output++
          }
          continue
        }
        const start = cursor
        if (source[cursor] === '\\' && source[cursor + 1] === run.text[output]
          && parseMarkdown(source.slice(cursor, cursor + 2))[0]?.text === run.text[output]) cursor++
        if (source[cursor] === '\r') {
          cursor++
          if (source[cursor] === '\n') cursor++
        } else cursor++
        positions.push({ start, end: cursor }); output++
      }
    }
    offsets.push(positions)
  }
  return { runs, offsets }
}
