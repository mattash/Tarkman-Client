import { expect, it } from '@jest/globals'
import fixture from './fixtures/public_liturgies/bundle.json'
import { LANGUAGES, parseBundle } from '../features/library/contracts'
import type { Bundle, BundleLanguage } from '../features/library/contracts'
import { createTextFindIndex, DEFAULT_TEXT_FIND_RESULTS, MAX_TEXT_FIND_QUERY_LENGTH, MAX_TEXT_FIND_RESULTS, resolveTextJump, searchTextFind } from '../features/library/textFind'

function bundleWith(texts: (string | null)[], language: BundleLanguage = 'en'): Bundle {
  const bundle = parseBundle(fixture)
  bundle.parts = texts.map((text, i) => ({ ...bundle.parts[0], liturgy_part_id: 900 + i, position: i + 1,
    text: Object.fromEntries(LANGUAGES.map(l => [l, l === language ? text : null])) as Bundle['parts'][number]['text'] }))
  bundle.languages_available = [language]
  return bundle
}

it('pins repeated occurrences and revision identity in deterministic bundle/source order', () => {
  const bundle = bundleWith(['Lord Lord', 'Lord', null])
  const index = createTextFindIndex(bundle, 'en'), result = searchTextFind(index, 'lord')
  expect(result).toMatchObject({ truncated: false, queryTooLong: false })
  expect(result.matches.map(m => [m.liturgyPartId, m.partId, m.occurrenceIndex, m.start, m.end])).toEqual([
    [900, 801, 0, 0, 4], [900, 801, 0, 5, 9], [901, 801, 1, 0, 4],
  ])
  for (const match of result.matches) {
    expect(match).toMatchObject({ liturgyId: bundle.liturgy.id, revision: bundle.revision, language: 'en' })
    expect(resolveTextJump(bundle, match)).toEqual({ occurrenceIndex: match.occurrenceIndex, start: match.start, end: match.end })
  }
})
it.each([
  ['en', '😀 CAFÉ cafe\u0301 ＡＭＥＮ', 'cafe', ['CAFÉ', 'cafe\u0301']],
  ['ru', '😀 ГОСПОДИ Господи', 'господи', ['ГОСПОДИ', 'Господи']],
  ['grabar', '😀 ՏԷՐ տէր', 'տէր', ['ՏԷՐ', 'տէր']],
  ['hy_east', 'ՀԱՅԵՐԵՆ հայերեն', 'հայերեն', ['ՀԱՅԵՐԵՆ', 'հայերեն']],
  ['hy_west', 'ՀԱՅԵՐԷՆ հայերէն', 'հայերէն', ['ՀԱՅԵՐԷՆ', 'հայերէն']],
  ['translit', '😀 TĒR te\u0304r', 'ter', ['TĒR', 'te\u0304r']],
] as const)('normalizes %s while returning original UTF16 ranges', (language, source, query, expected) => {
  const result = searchTextFind(createTextFindIndex(bundleWith([source], language), language), query)
  expect(result.matches.map(m => source.slice(m.start, m.end))).toEqual(expected)
  expect(result.matches[0].start).toBe(source.startsWith('😀') ? 3 : 0)
})
it('folds compatibility expansions and collapses whitespace with complete source ranges', () => {
  const source = '😀 ﬃ a\r\n\t b cafe\u0301'
  const index = createTextFindIndex(bundleWith([source]), 'en')
  for (const [query, expected] of [['ffi', 'ﬃ'], ['a b', 'a\r\n\t b'], ['café', 'cafe\u0301']]) {
    const match = searchTextFind(index, query).matches[0]
    expect(source.slice(match.start, match.end)).toBe(expected)
  }
})
it('never searches other languages, explanations, or a missing-translation placeholder', () => {
  const bundle = bundleWith([null, 'English'])
  bundle.parts[0].text.ru = 'Господи'
  bundle.parts[0].requires_session_context = true
  bundle.parts[0].explanations = [{ id: 1, liturgy_part_id: 900, title: 'secret', description: 'secret' }]
  for (const query of ['Господи', 'secret', 'session']) expect(searchTextFind(createTextFindIndex(bundle, 'en'), query).matches).toEqual([])
  expect(searchTextFind(createTextFindIndex(bundle, 'ru'), 'господи').matches).toHaveLength(1)
})
it('does not mutate or retain mutable bundle parts', () => {
  const bundle = bundleWith(['First']), before = JSON.stringify(bundle)
  const index = createTextFindIndex(bundle, 'en')
  expect(JSON.stringify(bundle)).toBe(before)
  bundle.revision = 'changed'; bundle.parts[0].text.en = 'Second'; bundle.parts[0].liturgy_part_id = 999
  expect(searchTextFind(index, 'first').matches[0]).toMatchObject({ revision: fixture.revision, liturgyPartId: 900 })
  expect(Object.isFrozen(index)).toBe(true)
  expect(Object.isFrozen(index.entries)).toBe(true)
  expect(Object.isFrozen(index.entries[0].offsets)).toBe(true)
})
it('rejects stale, wrong-language, wrong-occurrence, and invalid UTF16 addresses', () => {
  const bundle = bundleWith(['😀 Lord', 'Lord']), target = searchTextFind(createTextFindIndex(bundle, 'en'), 'lord').matches[0]
  for (const change of [{ revision: 'stale' }, { liturgyId: 1 }, { language: 'ru' as const }, { liturgyPartId: 901 }, { partId: 2 },
    { occurrenceIndex: 1 }, { occurrenceIndex: -1 }, { occurrenceIndex: 0.5 }, { start: -1 }, { start: 1 }, { end: 999 }, { end: 0 }, { end: NaN }]) {
    expect(resolveTextJump(bundle, { ...target, ...change })).toBeNull()
  }
  expect(resolveTextJump(bundle, target, 'ru')).toBeNull()
  expect(resolveTextJump({ ...bundle, revision: 'next' }, target)).toBeNull()
})
it('treats queries literally, ignores blank queries, and never crosses occurrence boundaries', () => {
  const index = createTextFindIndex(bundleWith(['a.b [x] a', 'b']), 'en')
  expect(searchTextFind(index, '.').matches).toHaveLength(1)
  for (const query of ['', ' \r\n\t', '\u0301', 'a b', '.*']) expect(searchTextFind(index, query).matches).toEqual([])
})
it('searches displayed Markdown labels and emphasis without hidden URL or delimiter hits', () => {
  const source = '**Lord** [Lord](https://example.test/hidden) \\*literal\\* `code`'
  const index = createTextFindIndex(bundleWith([source]), 'en')
  expect(searchTextFind(index, 'lord').matches.map(m => source.slice(m.start, m.end))).toEqual(['Lord', 'Lord'])
  for (const query of ['hidden', 'https', '**', '](']) expect(searchTextFind(index, query).matches).toEqual([])
  expect(searchTextFind(index, 'code').matches.map(m => source.slice(m.start, m.end))).toEqual(['code'])
  expect(searchTextFind(index, 'lord lord').matches).toHaveLength(1)
})
it('maps expansions plus removed marks as whole clusters even when lengths cancel', () => {
  const source = 'ﬀ\u0301'
  const result = searchTextFind(createTextFindIndex(bundleWith([source]), 'en'), 'f', { maxResults: 1 })
  expect(result).toMatchObject({ matches: [{ start: 0, end: 2 }], truncated: false })
})
it('never returns addresses splitting a surrogate pair', () => {
  const bundle = bundleWith(['😀']), index = createTextFindIndex(bundle, 'en')
  expect(searchTextFind(index, '\uD83D').matches).toEqual([])
  expect(searchTextFind(index, '\uDE00').matches).toEqual([])
  const match = searchTextFind(index, '😀').matches[0]
  expect(match).toMatchObject({ start: 0, end: 2 })
  expect(resolveTextJump(bundle, match)).toEqual({ occurrenceIndex: 0, start: 0, end: 2 })
})
it('deduplicates compatibility expansion spans before deciding truncation', () => {
  const index = createTextFindIndex(bundleWith(['ﬃ']), 'en')
  expect(searchTextFind(index, 'f', { maxResults: 1 })).toMatchObject({ matches: [{ start: 0, end: 1 }], truncated: false })
})
it('bounds query/output work and distinguishes exactly-full from truncated results', () => {
  const index = createTextFindIndex(bundleWith(['a '.repeat(MAX_TEXT_FIND_RESULTS + 1)]), 'en')
  expect(searchTextFind(index, 'a').matches).toHaveLength(DEFAULT_TEXT_FIND_RESULTS)
  expect(searchTextFind(index, 'a').truncated).toBe(true)
  expect(searchTextFind(index, 'a', { maxResults: Infinity }).matches).toHaveLength(DEFAULT_TEXT_FIND_RESULTS)
  expect(searchTextFind(index, 'a', { maxResults: 999999 }).matches).toHaveLength(MAX_TEXT_FIND_RESULTS)
  expect(searchTextFind(index, 'a', { maxResults: 0 }).matches).toHaveLength(1)
  expect(searchTextFind(index, 'a'.repeat(MAX_TEXT_FIND_QUERY_LENGTH + 1))).toEqual({ matches: [], truncated: false, queryTooLong: true })
  expect(searchTextFind(createTextFindIndex(bundleWith(['a a']), 'en'), 'a', { maxResults: 2 }).truncated).toBe(false)
})
it('indexes a near-limit plain bundle without per-character offset allocations', () => {
  const text = 'Lord have mercy '.repeat(65535)
  const index = createTextFindIndex(bundleWith(Array.from({ length: 9 }, () => text)), 'en')
  expect(index.entries).toHaveLength(9)
  expect(index.entries.every(entry => entry.offsets.length === 1)).toBe(true)
  expect(searchTextFind(index, 'not present').matches).toEqual([])
  expect(searchTextFind(index, 'lord').matches).toHaveLength(DEFAULT_TEXT_FIND_RESULTS)
})
it.each([['grabar', 'ՏԷՐ ՈՂՈՐՄԵԱ '], ['ru', 'Господи помилуй ']] as const)('keeps large plain %s indexes sparse too', (language, phrase) => {
  const source = phrase.repeat(20000)
  const index = createTextFindIndex(bundleWith([source], language), language)
  expect(index.entries[0].offsets).toHaveLength(1)
  const match = searchTextFind(index, phrase.trim()).matches[0]
  expect(source.slice(match.start, match.end)).toBe(phrase.trim())
})
it('indexes long text once with sparse offsets and finds late matches without clipping', () => {
  const source = 'a'.repeat(1024 * 1024 - 16) + ' UNIQUE'
  const index = createTextFindIndex(bundleWith([source]), 'en')
  expect(index.entries[0].offsets).toHaveLength(1)
  const match = searchTextFind(index, 'unique').matches[0]
  expect(source.slice(match.start, match.end)).toBe('UNIQUE')
  expect(searchTextFind(index, 'missing').matches).toEqual([])
})
