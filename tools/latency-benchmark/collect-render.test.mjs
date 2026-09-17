import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDocuments, collectRender } from './collect-render.mjs'

test('reads CLI streaming documents including braces and escaped quotes inside log messages', () => {
  const rows = [{ message: 'a } and "quoted" { string' }, { message: 'two', labels: [] }]
  assert.deepEqual(parseDocuments(rows.map(r => JSON.stringify(r, null, 2)).join('\n')), rows)
  assert.deepEqual(parseDocuments(JSON.stringify(rows)), rows)
  assert.throws(() => parseDocuments('{"message":'), /Incomplete/)
})

test('joins worker job IDs to their request and retains missing jobs as incomplete coverage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tarkman-render-test-'))
  const run = { mode: 'production', session: 4008, run: 'run_1', started_at: '2026-09-17T00:00:00Z', metadata: {}, samples: [], events: [], errors: [],
    network: [{ instrumented: true, request_id: 'missing_request' }] }
  const record = { type: 'latency_benchmark', schema: 1, kind: 'request', metadata: { run: 'run_1' }, aggregated_only: 500, spans: [{ name: 'enqueue.active_job', job_id: 'job_1' }] }
  try {
    const result = await collectRender(run, dir, { query: () => JSON.stringify({ id: 'log_1', message: JSON.stringify(record), timestamp: run.started_at }) })
    assert.deepEqual(result.missing_job_ids, ['job_1'])
    assert.deepEqual(result.missing_request_ids, ['missing_request'])
    assert.equal(result.pagination_complete, true)
    assert.equal(result.aggregated_only_spans, 500)
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'run.json'))).metadata.render_log_capture, result)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
