import { parseMarkdownSource } from '../../design/markdownSource'
import type { Bundle, BundleLanguage } from './contracts'

export const MAX_TEXT_FIND_QUERY_LENGTH = 512
export const MAX_TEXT_FIND_RESULTS = 1000
export const DEFAULT_TEXT_FIND_RESULTS = 200

/** Revision-scoped, occurrence-scoped address. Offsets are source UTF-16, end exclusive. */
export interface TextJumpTarget {
  readonly liturgyId: number
  readonly revision: string
  readonly language: BundleLanguage
  readonly liturgyPartId: number
  readonly partId: number
  readonly occurrenceIndex: number
  readonly start: number
  readonly end: number
}
interface OffsetRun {
  readonly linear: boolean
  readonly start: number
  readonly end: number
  readonly sourceStart: number
  readonly sourceEnd: number
}
export interface TextFindEntry {
  readonly liturgyPartId: number
  readonly partId: number
  readonly occurrenceIndex: number
  readonly source: string
  readonly normalized: string
  readonly offsets: readonly OffsetRun[]
}
export interface TextFindIndex {
  readonly liturgyId: number
  readonly revision: string
  readonly language: BundleLanguage
  readonly entries: readonly TextFindEntry[]
}
export interface TextFindResults {
  readonly matches: readonly TextJumpTarget[]
  /** True only when at least one further match exists. Not a total-count estimate. */
  readonly truncated: boolean
  readonly queryTooLong: boolean
}
export interface ResolvedTextJump {
  readonly occurrenceIndex: number
  readonly start: number
  readonly end: number
}

const MARK = /\p{M}/u
const MARKS = /\p{M}/gu
const SPACE = /^\s+$/u

/** Locale-independent compatibility/case/diacritic fold; never transliterates between scripts. */
function fold(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(MARKS, '')
}

function normalize(source: string, sourceOffsets?: readonly { start: number; end: number }[]): { normalized: string; offsets: readonly OffsetRun[] } {
  // Common English/plain transliteration: folding preserves every UTF-16 position.
  // Process the complete string in native operations, not one JS object per letter.
  if (!sourceOffsets && source.length > 0 && /^[\t\n\r -~]*$/.test(source) && !/\s{2}/.test(source)) {
    return { normalized: source.toLowerCase().replace(/\s/g, ' '), offsets: Object.freeze([
      Object.freeze({ linear: true, start: 0, end: source.length, sourceStart: 0, sourceEnd: source.length }),
    ]) }
  }
  // Armenian/Cyrillic and precomposed Latin also retain positions when no source
  // combining sequence, supplementary code point or compatibility expansion exists.
  if (!sourceOffsets && source.length > 0 && !/[\p{M}\uD800-\uDFFF]/u.test(source) && !/\s{2}/.test(source)) {
    const normalized = fold(source).replace(/\s/g, ' ')
    if (normalized.length === source.length) return { normalized, offsets: Object.freeze([
      Object.freeze({ linear: true, start: 0, end: source.length, sourceStart: 0, sourceEnd: source.length }),
    ]) }
  }
  const offsets: OffsetRun[] = [], chunks: string[] = []
  let length = 0, batch = '', i = 0, previousSpace = false
  while (i < source.length) {
    const sourceStart = i
    const first = String.fromCodePoint(source.codePointAt(i)!)
    i += first.length
    // Keep combining sequences together so a highlight includes the original diacritics.
    while (i < source.length) {
      const next = String.fromCodePoint(source.codePointAt(i)!)
      if (!MARK.test(next)) break
      i += next.length
    }
    let value = fold(source.slice(sourceStart, i))
    if (!value) continue
    const rawStart = sourceOffsets ? sourceOffsets[sourceStart].start : sourceStart
    const rawEnd = sourceOffsets ? sourceOffsets[i - 1].end : i
    const isSpace = SPACE.test(value)
    if (isSpace) value = ' '
    if (isSpace && previousSpace) {
      const previous = offsets[offsets.length - 1]
      // Isolate the last space from a linear run before extending its source coverage.
      if (previous.linear && previous.end - previous.start > 1) {
        offsets[offsets.length - 1] = { ...previous, end: previous.end - 1, sourceEnd: previous.sourceEnd - 1 }
        offsets.push({ linear: false, start: length - 1, end: length, sourceStart: previous.sourceEnd - 1, sourceEnd: rawEnd })
      } else {
        offsets[offsets.length - 1] = { ...previous, linear: false, sourceEnd: rawEnd }
      }
      continue
    }
    previousSpace = isSpace
    const run = { linear: value.length === first.length && i - sourceStart === first.length && rawEnd - rawStart === value.length,
      start: length, end: length + value.length, sourceStart: rawStart, sourceEnd: rawEnd }
    const previous = offsets[offsets.length - 1]
    if (previous && previous.end === run.start && previous.sourceEnd === rawStart && previous.linear && run.linear) {
      offsets[offsets.length - 1] = { ...previous, end: run.end, sourceEnd: rawEnd }
    } else offsets.push(run)
    length += value.length
    batch += value
    if (batch.length >= 4096) { chunks.push(batch); batch = '' }
  }
  chunks.push(batch)
  return { normalized: chunks.join(''), offsets: Object.freeze(offsets.map(run => Object.freeze(run))) }
}

/** Build once per pinned bundle/language. Copies only strings/IDs, never retains mutable parts. */
export function createTextFindIndex(bundle: Bundle, language: BundleLanguage): TextFindIndex {
  const entries: TextFindEntry[] = []
  bundle.parts.forEach((part, occurrenceIndex) => {
    const source = part.text[language]
    // Never substitute another language, explanations, or session-context placeholder copy.
    if (source === null || source === undefined || source.length === 0) return
    // Plain long text needs neither parser work nor per-character mapping allocations.
    const visible = /[\\\\`*]/.test(source) || source.includes('[') ? parseMarkdownSource(source) : null
    const text = visible ? visible.runs.map(run => run.text).join('') : source
    const mappedOffsets = visible?.offsets.flat()
    entries.push(Object.freeze({ liturgyPartId: part.liturgy_part_id, partId: part.part_id, occurrenceIndex, source, ...normalize(text, mappedOffsets) }))
  })
  return Object.freeze({ liturgyId: bundle.liturgy.id, revision: bundle.revision, language, entries: Object.freeze(entries) })
}

function sourceOffset(entry: TextFindEntry, offset: number, end: boolean): number {
  let low = 0, high = entry.offsets.length - 1
  const position = end ? offset - 1 : offset
  while (low < high) {
    const mid = (low + high) >>> 1
    if (entry.offsets[mid].end <= position) low = mid + 1
    else high = mid
  }
  const run = entry.offsets[low]
  return run.linear
    ? run.sourceStart + offset - run.start
    : end ? run.sourceEnd : run.sourceStart
}

function splitsSurrogatePair(source: string, offset: number): boolean {
  return offset > 0 && offset < source.length &&
    /[\uD800-\uDBFF]/.test(source[offset - 1]) && /[\uDC00-\uDFFF]/.test(source[offset])
}

/** Literal, non-overlapping matches in bundle order, then source order; no query regex or I/O. */
export function searchTextFind(index: TextFindIndex, query: string, options: { maxResults?: number } = {}): TextFindResults {
  if (query.length > MAX_TEXT_FIND_QUERY_LENGTH) return Object.freeze({ matches: Object.freeze([]), truncated: false, queryTooLong: true })
  const needle = normalize(query).normalized.trim()
  const requested = options.maxResults ?? DEFAULT_TEXT_FIND_RESULTS
  const maxResults = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_TEXT_FIND_RESULTS, Math.floor(requested))) : DEFAULT_TEXT_FIND_RESULTS
  const matches: TextJumpTarget[] = []
  if (needle) {
    for (const entry of index.entries) {
      let offset = 0
      while (offset <= entry.normalized.length - needle.length) {
        const found = entry.normalized.indexOf(needle, offset)
        if (found < 0) break
        const matchEnd = found + needle.length
        if (splitsSurrogatePair(entry.normalized, found) || splitsSurrogatePair(entry.normalized, matchEnd)) { offset = matchEnd; continue }
        const start = sourceOffset(entry, found, false), end = sourceOffset(entry, found + needle.length, true)
        // Compatibility expansions can have multiple normalized matches at the same source span.
        const previous = matches[matches.length - 1]
        if (!previous || previous.occurrenceIndex !== entry.occurrenceIndex || previous.start !== start || previous.end !== end) {
          if (matches.length === maxResults) return Object.freeze({ matches: Object.freeze(matches), truncated: true, queryTooLong: false })
          matches.push(Object.freeze({ liturgyId: index.liturgyId, revision: index.revision, language: index.language,
            liturgyPartId: entry.liturgyPartId, partId: entry.partId, occurrenceIndex: entry.occurrenceIndex, start, end }))
        }
        offset = found + needle.length
      }
    }
  }
  return Object.freeze({ matches: Object.freeze(matches), truncated: false, queryTooLong: false })
}

/** Resolve only against the exact pinned revision; never fall back to repeated part_id. */
export function resolveTextJump(bundle: Bundle, target: TextJumpTarget, language: BundleLanguage = target.language): ResolvedTextJump | null {
  if (bundle.liturgy.id !== target.liturgyId || bundle.revision !== target.revision || language !== target.language ||
    !Number.isSafeInteger(target.occurrenceIndex) || target.occurrenceIndex < 0) return null
  const part = bundle.parts[target.occurrenceIndex]
  if (!part || part.liturgy_part_id !== target.liturgyPartId || part.part_id !== target.partId) return null
  const source = part.text[language]
  if (source === null || source === undefined || !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) ||
    target.start < 0 || target.end <= target.start || target.end > source.length) return null
  // Reject addresses cutting a surrogate pair even if supplied by a caller other than search.
  if (splitsSurrogatePair(source, target.start) || splitsSurrogatePair(source, target.end)) return null
  return Object.freeze({ occurrenceIndex: target.occurrenceIndex, start: target.start, end: target.end })
}
