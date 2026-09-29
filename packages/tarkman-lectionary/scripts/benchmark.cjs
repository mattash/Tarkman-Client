// Node/V8 diagnostics only. These are not Hermes heap or native cold-start measurements.
const { performance } = require('node:perf_hooks')
const { readFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { gzipSync } = require('node:zlib')
const path = require('node:path')

async function sample() {
  global.gc?.()
  const startHeap = process.memoryUsage().heapUsed
  let start = performance.now()
  const { bundledLectionary: library } = require('../dist/bundled.js')
  const moduleMs = performance.now() - start
  const heapAfterModule = process.memoryUsage().heapUsed
  const loadedAtStartup = Object.keys(require.cache).filter(name => /data\/202[67]-/.test(name)).length
  start = performance.now()
  const first = await library.getDay('2026-06-01', { language: 'hy' })
  if (!first.ok) throw Error(JSON.stringify(first))
  const firstLookupMs = performance.now() - start
  const heapAfterLookup = process.memoryUsage().heapUsed
  global.gc?.()
  const retainedHeapBytes = process.memoryUsage().heapUsed - startHeap
  start = performance.now()
  for (let i = 0; i < 1000; i++) await library.getDay('2026-06-01', { language: 'hy' })
  const cachedLookupMs = (performance.now() - start) / 1000
  const text = readFileSync(path.join(__dirname, '../data/2026-hy.json'), 'utf8')
  start = performance.now()
  for (let i = 0; i < 100; i++) JSON.parse(text)
  const parsePackMs = (performance.now() - start) / 100
  return { moduleMs, firstLookupMs, cachedLookupMs, parsePackMs, loadedAtStartup,
    moduleHeapBytes: heapAfterModule - startHeap, lookupHeapBytes: heapAfterLookup - heapAfterModule, retainedHeapBytes }
}
if (process.argv.includes('--sample')) sample().then(result => console.log(JSON.stringify(result)))
else {
  const samples = Array.from({ length: 10 }, () => JSON.parse(execFileSync(process.execPath, ['--expose-gc', __filename, '--sample'], { encoding: 'utf8' })))
  const medians = Object.fromEntries(Object.keys(samples[0]).map(key => [key, samples.map(sample => sample[key]).sort((a, b) => a - b)[5]]))
  const packs = require('../data/manifest.json').packs.map(pack => {
    const bytes = readFileSync(path.join(__dirname, '../data', pack.file))
    return { file: pack.file, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9, mtime: 0 }).length }
  })
  console.log(JSON.stringify({ runtime: process.version, platform: `${process.platform}/${process.arch}`, samples: 10, medians, packs }, null, 2))
}
