const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createLectionary, isCalendarDate } = require('../dist/index.js')
const { bundledLectionary } = require('../dist/bundled.js')
const manifest = require('../data/manifest.json')
const source = require('../data/2026-en.json')
const copy = value => JSON.parse(JSON.stringify(value))

test('all 1,460 public results preserve complete payloads and checksum identity', async () => {
  let count = 0, empty = 0
  for (const metadata of manifest.packs) {
    const bytes = fs.readFileSync(path.join(__dirname, '../data', metadata.file))
    assert.equal(bytes.length, metadata.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256)
    const pack = JSON.parse(bytes)
    assert.equal(Object.keys(pack.days).length, metadata.days)
    for (const [date, day] of Object.entries(pack.days)) {
      const result = await bundledLectionary.getDay(date, { language: metadata.language })
      assert.equal(result.ok, true, `${date}/${metadata.language}: ${JSON.stringify(result)}`)
      assert.deepEqual(result.day, day)
      assert.deepEqual(result.dataset, manifest)
      count++
      if (!day.ReadingsList.length) empty++
    }
  }
  assert.equal(count, 1460)
  assert.equal(empty, 16) // eight dates, in each language
})

test('strict dates, Gregorian leap rules, range boundaries and unsupported languages', async () => {
  for (const date of ['', '2026-1-01', '2026-01-1', '2026-02-29', '2027-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '0000-01-01', '2026-01-01T00:00:00Z', ' 2026-01-01', null]) {
    assert.equal(isCalendarDate(date), false)
    assert.deepEqual(await bundledLectionary.getDay(date), { ok: false, reason: 'invalid-date' })
  }
  for (const date of ['2000-02-29', '2028-02-29', '0001-01-01', '9999-12-31']) assert.equal(isCalendarDate(date), true)
  assert.equal(isCalendarDate('1900-02-29'), false)
  for (const date of ['2025-12-31', '2028-01-01', '2028-02-29']) assert.deepEqual(await bundledLectionary.getDay(date), { ok: false, reason: 'out-of-range' })
  for (const date of ['2026-01-01', '2026-12-31', '2027-01-01', '2027-12-31']) assert.equal((await bundledLectionary.getDay(date)).ok, true)
  for (const language of ['ru', 'EN', '', 'hy-AM', null, false, 0]) assert.deepEqual(await bundledLectionary.getDay('2026-01-01', { language }), { ok: false, reason: 'unsupported-language' })
  assert.deepEqual(await bundledLectionary.getDay('2026-01-01', null), { ok: false, reason: 'unsupported-language' })
})

test('date-only lookup stays unchanged across local midnight, DST and extreme zones', () => {
  const program = `const {bundledLectionary:l}=require(${JSON.stringify(path.resolve(__dirname, '../dist/bundled.js'))});
    (async()=>{for(const d of ['2026-01-01','2026-03-08','2026-11-01','2027-03-14','2027-11-07','2027-12-31']) {
      const r=await l.getDay(d); if(!r.ok||r.day.Date!==d) throw Error(d);
    }})().catch(e=>{console.error(e);process.exitCode=1})`
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) execFileSync(process.execPath, ['-e', program], { env: { ...process.env, TZ } })
})

test('loads only requested packs, shares pending loads, and isolates cache/metadata from mutation', async () => {
  const loaded = copy(source), metadata = copy(manifest)
  let loads = 0
  const library = createLectionary({ manifest: metadata, loadYear: () => { loads++; return loaded } })
  metadata.coverage.from = '2030-01-01'
  const [first, second] = await Promise.all([library.getDay('2026-01-05'), library.getDay('2026-06-01')])
  assert.equal(loads, 1)
  assert.ok(first.ok && second.ok)
  first.day.Readings.Gospel.push('mutated')
  first.day.Observances[0].is_fast = true
  first.dataset.languages.length = 0
  loaded.days['2026-01-05'].ReadingsList.length = 0
  library.getMetadata().coverage.from = '2030-01-01'
  const again = await library.getDay('2026-01-05')
  assert.deepEqual(again.day, source.days['2026-01-05'])
  assert.deepEqual(again.dataset, manifest)
  assert.equal(loads, 1)
})

test('load errors and absent packs are explicit and retryable', async () => {
  let loads = 0
  const library = createLectionary({ manifest, loadYear: () => { if (!loads++) throw Error('unavailable'); return source } })
  assert.deepEqual(await library.getDay('2026-01-01'), { ok: false, reason: 'data-load', detail: 'load-failed' })
  assert.equal((await library.getDay('2026-01-01')).ok, true)
  const missing = createLectionary({ manifest, loadYear: () => null })
  assert.deepEqual(await missing.getDay('2026-01-01'), { ok: false, reason: 'data-load', detail: 'missing-pack' })
  const absent = createLectionary({ manifest: { ...manifest, packs: [] }, loadYear: () => { throw Error('must not load') } })
  assert.deepEqual(await absent.getDay('2026-01-01'), { ok: false, reason: 'data-load', detail: 'missing-pack' })
})

test('corrupt and incompatible packs fail without leaking partial records', async () => {
  const mutations = [
    p => { p.schemaVersion = 2 }, p => { p.datasetId = 'other' }, p => { p.language = 'hy' }, p => { p.year = 2027 },
    p => { delete p.days['2026-01-01'] }, p => { p.days['2026-02-30'] = p.days['2026-02-28'] },
    p => { p.days['2026-01-05'].Readings.Gospel = null }, p => { p.days['2026-01-05'].ReadingsRefs[0].start_verse = '1' },
    p => { p.days['2026-01-05'].Observances[0].is_fast = null }, p => { p.days['2026-01-05'].ObservanceIds = [] },
    p => { p.days['2026-01-05'].Date = '2026-01-06' }, p => { p.days['2026-01-05'].Mode.Number = 9 },
  ]
  for (const mutate of mutations) {
    const pack = copy(source); mutate(pack)
    const library = createLectionary({ manifest, loadYear: () => pack })
    assert.deepEqual(await library.getDay('2026-01-05'), { ok: false, reason: 'data-load', detail: 'corrupt-pack' })
  }
})

test('future additive fields preserve null, false, empty and absent distinctions recursively', async () => {
  const pack = copy(source)
  const day = pack.days['2026-01-05']
  day.Future = { nullValue: null, falseValue: false, emptyList: [], emptyText: '', zero: 0, Armenian: 'ԱՁ' }
  day.Observances[0].future_attribute = null
  day.Mode.Future = { empty: {} }
  day.Confidence = null
  const library = createLectionary({ manifest, loadYear: () => pack })
  const result = await library.getDay('2026-01-05')
  assert.equal(result.ok, true)
  assert.deepEqual(result.day, day)
  assert.equal('Note' in result.day, false)
})

test('focused fixtures retain composites, independent observance marks, empties and confidence', async () => {
  const composite = (await bundledLectionary.getDay('2026-01-05', { language: 'hy' })).day
  assert.equal(composite.Readings.Gospel.length, 5)
  assert.equal(composite.ReadingsRefs.length, composite.ReadingsList.length + 1)
  const refs = composite.ReadingsRefs.filter(ref => ref.citation === 'Daniel 3.1-23, Azariah. 1-68')
  assert.deepEqual(refs.map(ref => ref.book), ['Daniel', 'Azariah'])
  const empty = (await bundledLectionary.getDay('2026-01-26')).day
  assert.deepEqual(empty.Readings, {})
  assert.equal(empty.Confidence, 'validated')
  assert.match(empty.Note, /intentional/)
  const collision = (await bundledLectionary.getDay('2026-04-07')).day
  assert.deepEqual(collision.ObservanceIds, ['third_day_of_easter', 'annunciation_to_the_virgin'])
  const lower = (await bundledLectionary.getDay('2026-08-05')).day
  assert.equal(lower.Source, 'generative-continua')
  assert.equal(lower.Confidence, 'best-guess')
  const days = [...Object.values(source.days), ...Object.values(require('../data/2027-en.json').days)]
  assert.ok(days.some(day => day.Observances.length > 1))
  assert.ok(days.some(day => day.Observances.some(item => item.is_fast && item.is_comm)))
  assert.ok(days.some(day => day.Confidence && day.Confidence !== 'validated'))
  for (const day of days.filter(day => day.Observances.length > 1 || day.Confidence && day.Confidence !== 'validated')) {
    assert.deepEqual((await bundledLectionary.getDay(day.Date)).day, day)
  }
})

test('runtime source has no platform dependencies or lectionary network calls', () => {
  for (const name of fs.readdirSync(path.join(__dirname, '../src'))) {
    const text = fs.readFileSync(path.join(__dirname, '../src', name), 'utf8')
    assert.doesNotMatch(text, /\b(?:fetch|XMLHttpRequest|process|window|document|localStorage)\b|(?:from\s*|require\()['"](?:node:|react|expo|fs|path|http)/)
  }
})
