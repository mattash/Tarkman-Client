import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import ts from '../../../apps/mobile/node_modules/typescript/lib/typescript.js'

// Use the same app-local compiler as core's tests; the reader has no runtime dependencies.
const source = fileURLToPath(new URL('../src/', import.meta.url))
const output = mkdtempSync(join(tmpdir(), 'tarkman-reader-test-'))
after(() => rmSync(output, { recursive: true, force: true }))
for (const entry of readdirSync(source, { recursive: true })) {
  if (!entry.endsWith('.ts')) continue
  const target = join(output, relative(source, join(source, entry))).replace(/\.ts$/, '.js')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, ts.transpileModule(readFileSync(join(source, entry), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)
}
const require = createRequire(import.meta.url)
const { createContracts } = require(join(output, 'contracts.js'))
const { projectionMessage, describeDisplay } = require(join(output, 'display/presentation.js'))
const { DEFAULT_DISPLAY_CONFIG } = require(join(output, 'display/config.js'))
const contracts = createContracts(key => key)
const t = key => `translated:${key}`
const session = (options = {}) => contracts.normalizeSession({ session: { id: 7, status: 'showing_prophetic', options } })

test('prophetic display uses the host translator and safe reading text like gospel and epistle', () => {
  for (const reading of ['gospel', 'epistle', 'prophetic']) {
    const value = contracts.normalizeSession({ session: { id: 7, status: `showing_${reading}`,
      options: { [reading]: '<p>Isaiah &amp; the prophets<br>Word</p><script>bad()</script>' } } })
    assert.deepEqual(projectionMessage(value, [], DEFAULT_DISPLAY_CONFIG, t), {
      kind: 'message', title: `translated:display.${reading}`, body: 'Isaiah & the prophets\nWord',
    })
  }
})

test('missing, nullable, empty and malformed prophetic options remain backward compatible', () => {
  for (const options of [{}, { prophetic: null }, { prophetic: '' }, { prophetic: '   ' }, { prophetic: 7 }]) {
    assert.deepEqual(projectionMessage(session(options), [], DEFAULT_DISPLAY_CONFIG, t), {
      kind: 'message', title: 'translated:display.prophetic', body: null,
    })
  }
  assert.equal(session().displayMessages.prophetic, null)
  assert.equal(session({ prophetic: null }).displayMessages.prophetic, null)
  const old = { ...session(), displayMessages: { gospel: null, epistle: null, before: null, after: null } }
  assert.equal(projectionMessage(old, [], DEFAULT_DISPLAY_CONFIG, t).body, null)
})

test('canonical readings are a fallback only when the prophetic option is missing', () => {
  const raw = { id: 7, status: 'showing_prophetic', readings: { prophetic: '<p>Isaiah 6:1</p>' } }
  for (const options of [undefined, null, [], {}, { gospel: 'Gospel' }]) {
    const value = contracts.normalizeSession({ session: { ...raw, options } })
    assert.equal(value.displayMessages.prophetic, '<p>Isaiah 6:1</p>')
    assert.equal(projectionMessage(value, [], DEFAULT_DISPLAY_CONFIG, t).body, 'Isaiah 6:1')
  }
  for (const prophetic of [null, '', ' ', 7, 'Option wins']) {
    const value = contracts.normalizeSession({ session: { ...raw, options: { prophetic } } })
    assert.equal(value.displayMessages.prophetic, typeof prophetic === 'string' ? prophetic : null)
  }
  for (const readings of [undefined, null, [], { prophetic: 7 }]) {
    assert.equal(contracts.normalizeSession({ session: { id: 7, readings } }).displayMessages.prophetic, null)
  }
})

test('prophetic notifications obey existing suppression preferences', () => {
  const value = session({ prophetic: 'Isaiah 6:1' })
  assert.equal(projectionMessage(value, [], { ...DEFAULT_DISPLAY_CONFIG, show_notifications: false }, t), null)
  assert.equal(projectionMessage(value, [], { ...DEFAULT_DISPLAY_CONFIG, status_view: 'none' }, t), null)
})

test('prophetic content changes invalidate the existing parts context', () => {
  const raw = { id: 7, liturgies: [{ id: 1 }], num_of_parts: 1, readings: { prophetic: 'Isaiah 6:1' }, options: { prophetic: 'First reading' } }
  const initial = contracts.normalizeSession({ session: raw }).partsContext
  assert.notEqual(contracts.normalizeSession({ session: { ...raw, readings: { prophetic: 'Isaiah 7:1' } } }).partsContext, initial)
  assert.notEqual(contracts.normalizeSession({ session: { ...raw, options: { prophetic: 'Edited reading' } } }).partsContext, initial)
})

test('session variable prophetic parts display backend-expanded multilingual text without accessor substitution', () => {
  // Session JSON expands the legacy variable en accessor on the backend. Other languages stay authored.
  const parts = contracts.normalizeParts({ parts: [{ part: { id: 1, position: 1,
    en: '<p>In the year that King Uzziah died.</p>', ru: 'В год смерти царя Озии.',
    grabar: 'Յամին յորում մեռաւ Ոզիա արքայ', translit: 'Hamin horum merav',
    hy_east: 'Ոզիա թագավորի մահվան տարում', hy_west: 'Ոզիա թագաւորին մահուան տարին' } }] })
  assert.equal(parts[0].text.ru, 'В год смерти царя Озии.')
  assert.equal(parts[0].text.grabar, 'Յամին յորում մեռաւ Ոզիա արքայ')
  assert.equal(parts[0].text.translit, 'Hamin horum merav')
  const value = contracts.normalizeSession({ session: { id: 7, current_part_id: 1, current_part_position: 1, status: 'active' } })
  const view = describeDisplay({ state: { session: value, parts, explanations: [] }, config: { ...DEFAULT_DISPLAY_CONFIG, mode: 'single', lang1: 'en' },
    sessionId: 7, width: 1920, height: 1080, fontScale: 1, spacing: { md: 16, xl: 32 }, t })
  assert.equal(view.kind, 'projection')
  assert.deepEqual(view.texts, ['In the year that King Uzziah died.'])
  assert.equal(view.readingRunning, true)
  for (const [language, expected] of [['grabar', parts[0].text.grabar], ['translit', parts[0].text.translit],
    ['hye', parts[0].hyEast], ['hyw', parts[0].hyWest]]) {
    const translated = describeDisplay({ state: { session: value, parts, explanations: [] },
      config: { ...DEFAULT_DISPLAY_CONFIG, mode: 'single', lang1: language },
      sessionId: 7, width: 1920, height: 1080, fontScale: 1, spacing: { md: 16, xl: 32 }, t })
    assert.deepEqual(translated.texts, [expected])
  }
})
