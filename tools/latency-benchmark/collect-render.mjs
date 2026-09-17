import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseServerLogs, writeReport } from './report.mjs'

export const RESOURCES = ['srv-d4gimpali9vc73dl02vg', 'srv-d4gio34hg0os73fqro8g']

// Render CLI emits successive pretty-printed JSON documents, not necessarily a JSON array.
export function parseDocuments(input) {
  const documents = []
  let start = -1, depth = 0, quoted = false, escaped = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (start < 0) { if (char === '{' || char === '[') { start = i; depth = 1 }; continue }
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') {
      if (--depth === 0) {
        const document = JSON.parse(input.slice(start, i + 1))
        documents.push(...(Array.isArray(document) ? document : [document])); start = -1
      }
    }
  }
  if (start >= 0) throw new Error('Incomplete Render JSON output; log capture is not complete.')
  return documents
}

export async function collectRender(run, outputDirectory, { query = args => execFileSync('render', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 }) } = {}) {
  if (run.mode !== 'production' || run.session !== 4008 || !/^[a-zA-Z0-9_-]{1,80}$/.test(run.run)) throw new Error('Render collection requires a production session-4008 run.')
  const logs = new Map(), end = new Date().toISOString()
  let start = run.started_at, complete = false
  for (let page = 0; page < 30; page++) {
    const raw = query(['logs', '--resources', RESOURCES.join(','), '--start', start, '--end', end,
      '--text', run.run, '--type', 'app', '--direction', 'forward', '--limit', '1000', '--output', 'json'])
    const batch = parseDocuments(raw)
    for (const log of batch) if (log.id && typeof log.message === 'string') logs.set(log.id, log)
    if (batch.length < 1000) { complete = true; break }
    const next = batch.at(-1)?.timestamp
    if (!next || next === start) break
    start = next // Inclusive boundary; IDs deduplicate overlap instead of dropping same-timestamp entries.
  }
  const records = [...logs.values()].flatMap(log => parseServerLogs(log.message, run.run).map(record => ({ ...record,
    render_log_id: log.id, render_timestamp: log.timestamp,
    resource: log.labels?.find(label => label.name === 'resource')?.value })))
  const enqueued = new Set(records.flatMap(r => (r.spans || []).filter(s => s.name === 'enqueue.active_job' || s.name === 'enqueue_at.active_job').map(s => s.job_id)).filter(Boolean))
  const performed = new Set(records.filter(r => r.kind === 'job').map(r => r.job_id))
  const requestIds = new Set(records.filter(r => r.kind === 'request').map(r => r.request_id))
  const expectedRequests = (run.network || []).filter(r => r.instrumented && r.request_id)
  const capture = { resources: RESOURCES, start: run.started_at, end, pagination_complete: complete,
    records: records.length, missing_job_ids: [...enqueued].filter(id => !performed.has(id)),
    missing_request_ids: [...new Set(expectedRequests.filter(r => !requestIds.has(r.request_id)).map(r => r.request_id))],
    malformed_diagnostic_logs: [...logs.values()].filter(log => log.message.includes('{"type":"latency_benchmark"') && !parseServerLogs(log.message, run.run).length).length,
    aggregated_only_spans: records.reduce((sum, r) => sum + (r.aggregated_only || 0), 0),
    dropped_spans: records.reduce((sum, r) => sum + (r.dropped || 0), 0) }
  await writeFile(`${outputDirectory}/server.jsonl`, records.map(r => JSON.stringify(r)).join('\n') + '\n')
  await writeFile(`${outputDirectory}/render-log-capture.json`, JSON.stringify(capture, null, 2))
  await writeReport({ ...run, metadata: { ...run.metadata, render_log_capture: capture } }, `${outputDirectory}/report.html`, { server: records })
  return capture
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2]
  if (!path) throw new Error('Usage: node collect-render.mjs results/<run>/run.json')
  console.log(JSON.stringify(await collectRender(JSON.parse(await readFile(path, 'utf8')), dirname(path)), null, 2))
}
