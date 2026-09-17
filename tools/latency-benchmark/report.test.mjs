import test from 'node:test'
import assert from 'node:assert/strict'
import { percentile, summarize, parseServerLogs } from './report.mjs'

test('percentiles exclude failures, warmups, and missing observations without hiding their outcomes', () => {
  const run = { samples: [
    { command: 'warm', warmup: true, outcome: 'success', target_key: 'a' },
    { command: 'ok', outcome: 'success', target_key: 'b' },
    { command: 'fail', outcome: 'failed_or_timed_out', target_key: 'c' },
  ], events: [
    { command: 'ok', client: 'controller', name: 'control.tap', at_ms: 100 },
    { command: 'ok', client: 'reader_1', name: 'ui.visible_estimate', part_key: 'a', at_ms: 101 },
    { command: 'ok', client: 'reader_1', name: 'ui.visible_estimate', part_key: 'b', at_ms: 450 },
    { command: 'fail', client: 'controller', name: 'control.tap', at_ms: 500 },
  ] }
  const result = summarize(run)
  assert.equal(result.measured, 2)
  assert.equal(result.failures, 1)
  assert.equal(result.summary.find(s => s.client === 'reader_1').median_ms, 350)
  assert.equal(result.summary.find(s => s.client === 'controller').n, 0)
})

test('nearest-rank percentile retains slow tails and empty sets are unavailable', () => {
  assert.equal(percentile([], 0.95), null)
  assert.equal(percentile([1, 2, 3, 4, 1000], 0.95), 1000)
})

test('only same-run structured server records are imported', () => {
  const record = run => JSON.stringify({ type: 'latency_benchmark', schema: 1, metadata: { run } })
  const records = parseServerLogs(`Rails prefix ${record('wanted')}\n${record('other')}\nmalformed\n`, 'wanted')
  assert.equal(records.length, 1)
  assert.equal(records[0].metadata.run, 'wanted')
})
