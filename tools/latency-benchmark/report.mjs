import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null
}

export function summarize(run) {
  const measured = run.samples.filter(s => !s.warmup)
  const rows = measured.map(sample => {
    const events = run.events.filter(e => e.command === sample.command)
    const tap = events.find(e => e.name === 'control.tap' && e.client === 'controller')?.at_ms
    const clients = [...new Set(run.events.map(e => e.client))]
    const timings = clients.map(client => {
      const own = events.filter(e => e.client === client)
      const delta = name => {
        const at = own.find(e => e.name === name && (name !== 'ui.visible_estimate' || e.part_key === sample.target_key))?.at_ms
        return Number.isFinite(at) && Number.isFinite(tap) && at >= tap ? at - tap : null
      }
      return { client, response_ms: delta('command.response'), cable_ms: delta('cable.received'), visible_ms: delta('ui.visible_estimate'),
        recoveries: own.filter(e => e.name === 'recovery.start').length,
        discarded: own.filter(e => e.name === 'recovery.discarded').length,
        fetches: own.filter(e => e.name === 'fetch.start').length }
    })
    return { ...sample, tap, timings }
  })
  const clients = [...new Set(rows.flatMap(r => r.timings.map(t => t.client)))]
  const summary = clients.map(client => {
    const valid = rows.filter(r => r.outcome === 'success').map(r => r.timings.find(t => t.client === client)?.visible_ms).filter(v => v !== null && v !== undefined)
    return { client, n: valid.length, median_ms: percentile(valid, 0.5), p95_ms: percentile(valid, 0.95),
      max_ms: valid.length ? Math.max(...valid) : null }
  })
  return { measured: rows.length, failures: rows.filter(r => r.outcome !== 'success').length, rows, summary }
}

export function parseServerLogs(text, runId) {
  const records = []
  for (const line of text.split('\n')) {
    const start = line.indexOf('{"type":"latency_benchmark"')
    if (start < 0) continue
    try {
      const record = JSON.parse(line.slice(start))
      if (record.schema === 1 && record.metadata?.run === runId) records.push(record)
    } catch { /* Other Rails logs are not benchmark records. */ }
  }
  return records
}

export async function writeReport(run, output, { server = [], metrics = null, comparison = null } = {}) {
  const analysis = summarize(run)
  const data = JSON.stringify({ run, analysis, server, metrics, comparison: comparison ? summarize(comparison) : null }).replaceAll('<', '\\u003c')
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tarkman · Session latency</title><style>
:root{color-scheme:light dark;font:16px/1.5 system-ui;background:#11151d;color:#e5eaf3}body{max-width:1240px;margin:40px auto;padding:0 24px}h1{font-size:32px;margin-bottom:4px}h2{font-size:21px;margin-top:36px}p{max-width:100ch;color:#bcc8dc}.muted{color:#a3b1c8;font-size:14px}.tag{padding:4px 9px;border:1px solid #46526a;border-radius:6px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:10px 12px;border-bottom:1px solid #303b50;text-align:left}th{color:#a3b1c8;font-weight:500}button,select{font:inherit;padding:8px 12px;background:#222c3f;color:inherit;border:1px solid #46526a;border-radius:6px}button{cursor:pointer}button:hover{background:#354867}.error{color:#ffb5a9}.barrow{display:grid;grid-template-columns:245px 1fr 90px;gap:12px;align-items:center;margin:6px 0;font-size:13px}.track{height:15px;background:#1d2738;border-radius:3px;position:relative}.bar{position:absolute;height:15px;min-width:3px;background:#83b5ff;border-radius:3px}.point{background:#8ee3bd}pre{white-space:pre-wrap;font-size:12px;padding:16px;background:#1a2231;overflow:auto}details{margin:10px 0}summary{cursor:pointer}.scroll{overflow-x:auto}a{color:#b3d2ff}
</style><h1>Tarkman · Session latency</h1><div id="meta"></div><p>Tap → correct reading visible, measured separately for the controller and each reader. Visibility is a browser-frame estimate; it includes list scrolling. Server and worker clocks are not subtracted from browser clocks.</p><div id="status"></div><h2>Measured commands</h2><div id="summary"></div><p class="muted">Warmups excluded. Nearest-rank median/p95 use successful, complete samples only; failures remain in the table. Small samples are exploratory; p99 is intentionally omitted.</p><div class="scroll" id="samples"></div><h2 id="detail-title">Command waterfall</h2><p class="muted">Browser offsets are relative to the actual press handler. Parallel fetches overlap. Server spans below each request use that server request's own clock and may nest; do not add their durations.</p><div id="detail"></div><h2>Run metadata and limitations</h2><pre id="config"></pre><details><summary>Capture errors</summary><pre id="errors"></pre></details><details><summary>Render metric snapshot (if imported)</summary><pre id="metrics"></pre></details>
<script type="application/json" id="data">${data}</script><script>
const {run,analysis,server,metrics,comparison}=JSON.parse(document.getElementById('data').textContent);
const el=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), ms=n=>n==null?'—':n.toFixed(1)+' ms';
el('meta').textContent=run.mode.toUpperCase()+' · Session '+run.session+' · '+run.started_at+' · '+run.run;
const capture=run.metadata.render_log_capture;
const gaps=capture&&(!capture.pagination_complete||capture.missing_job_ids?.length||capture.missing_request_ids?.length||capture.malformed_diagnostic_logs||capture.dropped_spans);
el('status').innerHTML='<p class="tag">'+analysis.measured+' measured · '+analysis.failures+' unsuccessful · Position restored: '+esc(run.position_restored)+' · Server records: '+server.length+'</p>'+(run.mode==='synthetic'?'<p class="error">Synthetic fixture — these numbers do not describe production.</p>':'')+(gaps?'<p class="error">Server capture has gaps. Inspect render_log_capture in the metadata before interpreting the breakdown.</p>':'')+(!server.length?'<p class="error">Backend logs have not been imported. The server/worker breakdown is incomplete.</p>':'');
el('summary').innerHTML='<table><tr><th>Client</th><th>Complete samples</th><th>Median</th><th>p95</th><th>Maximum</th><th>p95 change</th></tr>'+analysis.summary.map(s=>{const before=comparison?.summary.find(c=>c.client===s.client);return '<tr><td>'+esc(s.client)+'</td><td>'+s.n+'</td><td>'+ms(s.median_ms)+'</td><td>'+ms(s.p95_ms)+'</td><td>'+ms(s.max_ms)+'</td><td>'+ms(before?.p95_ms!=null&&s.p95_ms!=null?s.p95_ms-before.p95_ms:null)+'</td></tr>'}).join('')+'</table>';
el('samples').innerHTML='<table><tr><th>Command</th><th>Direction</th><th>Outcome</th><th>Controller</th><th>Slowest reader</th><th>GETs / discarded</th></tr>'+analysis.rows.map((r,i)=>{const readers=r.timings.filter(t=>t.client!=='controller').map(t=>t.visible_ms).filter(t=>t!=null);return '<tr><td><button data-index="'+i+'">'+(i+1)+' · '+esc(r.command.slice(0,8))+'</button></td><td>'+esc(r.direction)+'</td><td>'+esc(r.outcome)+'</td><td>'+ms(r.timings.find(t=>t.client==='controller')?.visible_ms)+'</td><td>'+ms(readers.length?Math.max(...readers):null)+'</td><td>'+r.timings.reduce((n,t)=>n+t.fetches,0)+' / '+r.timings.reduce((n,t)=>n+t.discarded,0)+'</td></tr>'}).join('')+'</table>';
function show(i){const row=analysis.rows[i];if(!row)return;el('detail-title').textContent='Command '+(i+1)+' · '+row.direction+' · '+row.outcome;const events=run.events.filter(e=>e.command===row.command&&e.at_ms>=row.tap),end=Math.max(1,...events.map(e=>e.at_ms-row.tap));let html='';
for(const client of [...new Set(events.map(e=>e.client))]){html+='<h3>'+esc(client)+'</h3>';const own=events.filter(e=>e.client===client);for(const e of own){if(['fetch.headers','fetch.parsed','recovery.end','ui.commit'].includes(e.name))continue;let finish=e.at_ms;if(e.name==='fetch.start')finish=own.find(x=>x.name==='fetch.parsed'&&x.request===e.request)?.at_ms??e.at_ms;if(e.name==='recovery.start')finish=own.find(x=>x.name==='recovery.end'&&x.cycle===e.cycle)?.at_ms??e.at_ms;const duration=finish-e.at_ms;html+='<div class="barrow"><span>'+esc(e.name+(e.path?' '+e.path.split('/').slice(-1)[0]:'')+(e.reason?' · '+e.reason:''))+'</span><div class="track"><div class="bar '+(duration?'':'point')+'" style="left:'+((e.at_ms-row.tap)/end*100)+'%;width:'+(duration/end*100)+'%"></div></div><span>'+ms(duration||e.at_ms-row.tap)+'</span></div>';}}
const requests=run.network.filter(r=>r.command===row.command);html+='<h3>HTTP requests</h3><p class="muted">Header timing and transfer completion are separate observations. A blank transfer duration means Chrome did not report completion before capture ended; the app does not consume successful control response bodies.</p><table><tr><th>Client / path</th><th>Status</th><th>Headers received</th><th>Transfer complete</th><th>Observed body bytes</th><th>Server timing</th></tr>'+requests.map(r=>'<tr><td>'+esc(r.client+' '+r.path)+'</td><td>'+r.status+'</td><td>'+ms(r.timing.receiveHeadersEnd)+'</td><td>'+ms(r.timing.responseEnd)+'</td><td>'+esc(r.sizes?.responseBodySize)+'</td><td>'+esc(r.server_timing)+'</td></tr>').join('')+'</table>';
for(const record of server.filter(s=>s.metadata.command===row.command)){html+='<details><summary>'+esc(record.kind+' · '+(record.path||record.job||'ActionCable')+' · '+ms(record.duration_ms))+'</summary><p class="muted">'+esc(record.metadata.client+' / '+(record.metadata.request||record.job_id||'')+(record.queue_wait_estimate_ms!=null?' · Queue wait estimate '+ms(record.queue_wait_estimate_ms):''))+'</p><table><tr><th>Span</th><th>Offset in server context</th><th>Duration</th></tr>'+(record.spans||[]).map(s=>'<tr><td>'+esc(s.name+(s.operation?' · '+s.operation:''))+'</td><td>'+ms(s.offset_ms)+'</td><td>'+ms(s.duration_ms)+'</td></tr>').join('')+'</table></details>';}
el('detail').innerHTML=html;}
el('samples').addEventListener('click',e=>{const button=e.target.closest('button[data-index]');if(button)show(Number(button.dataset.index));});
el('config').textContent=JSON.stringify(run.metadata,null,2);el('errors').textContent=JSON.stringify(run.errors,null,2);el('metrics').textContent=JSON.stringify(metrics??'Not imported',null,2);show(0);
</script></html>`
  await writeFile(output, html)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output = 'report.html', serverFile, metricsFile, compareFile] = process.argv.slice(2)
  if (!input) throw new Error('Usage: node report.mjs run.json report.html [server.jsonl] [metrics.json] [before-run.json]')
  const run = JSON.parse(await readFile(input, 'utf8'))
  await writeReport(run, output, { server: serverFile ? parseServerLogs(await readFile(serverFile, 'utf8'), run.run) : [],
    metrics: metricsFile ? JSON.parse(await readFile(metricsFile, 'utf8')) : null,
    comparison: compareFile ? JSON.parse(await readFile(compareFile, 'utf8')) : null })
  console.log(output)
}
