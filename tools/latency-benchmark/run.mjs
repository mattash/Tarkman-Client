import { chromium } from 'playwright'
import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { installBridge } from './browser.mjs'
import { writeReport } from './report.mjs'
import { collectRender } from './collect-render.mjs'

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://localhost:8101' }, api: { type: 'string', default: 'https://www.tarkman.app' },
  session: { type: 'string', default: '4008' }, 'allow-session': { type: 'string' }, samples: { type: 'string', default: '20' },
  warmup: { type: 'string', default: '4' }, readers: { type: 'string', default: '2' }, interval: { type: 'string', default: '2000' },
  timeout: { type: 'string', default: '20000' }, out: { type: 'string' }, fixture: { type: 'boolean' },
  headless: { type: 'boolean' }, 'client-only': { type: 'boolean' }, 'prepare-only': { type: 'boolean' },
  'profile': { type: 'string', default: '.profiles/controller' },
} })
const session = Number(values.session), samples = Number(values.samples), readers = Number(values.readers)
const warmup = Number(values.warmup), interval = Number(values.interval), timeout = Number(values.timeout)
if (![session, samples, readers, warmup, interval, timeout].every(Number.isSafeInteger) || session !== 4008 ||
    samples < 2 || samples > 300 || samples % 2 || warmup < 0 || warmup > 20 || warmup % 2 || readers < 1 || readers > 5 || interval < 500 || timeout < 1000 || timeout > 60000) {
  throw new Error('Use session 4008, an even 2–300 samples, even 0–20 warmups, 1–5 readers, interval >=500ms, timeout 1000–60000ms.')
}
if (!values.fixture && !values['prepare-only'] && values['allow-session'] !== '4008') throw new Error('Production controls require --allow-session 4008. Use --prepare-only to inspect without moving the session.')
const api = values.api.replace(/\/$/, ''), url = values.url.replace(/\/$/, '')
if (values.fixture && api !== 'https://localhost:8100') throw new Error('Fixture mode requires --api https://localhost:8100 and a fixture-configured Expo export.')
if (!values.fixture && api !== 'https://www.tarkman.app') throw new Error('Production runs are restricted to https://www.tarkman.app.')
const run = randomUUID(), output = resolve(values.out || `results/${run}`)
await mkdir(output, { recursive: true })
const result = { schema: 1, run, session, mode: values.fixture ? 'synthetic' : 'production', api, url,
  started_at: new Date().toISOString(), samples: [], events: [], network: [], errors: [], metadata: {
    samples, warmup, readers, interval, timeout, client_only: !!values['client-only'],
    client_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    client_dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    platform: process.platform, viewport: { width: 430, height: 932 },
    clock: 'Browser performance.timeOrigin + performance.now; no cross-host clock subtraction',
    visible_metric: 'Correct reading top intersects viewport and remains stable across two animation-frame intervals; a paint estimate, not physical display measurement',
  } }
const clients = [], contexts = []
let context, initialKey, lastKey, stop = false, mutationUncertain = false
process.on('SIGINT', () => { stop = true })
process.on('SIGTERM', () => { stop = true })

async function waitFor(check, milliseconds, description) {
  const deadline = performance.now() + milliseconds
  while (performance.now() < deadline) {
    if (await check()) return
    if (stop) throw new Error('Interrupted; no further commands will be sent.')
    await delay(50)
  }
  throw new Error(`Timed out: ${description}`)
}
async function drain() {
  for (const client of clients) result.events.push(...await client.page.evaluate(() => globalThis.__TARKMAN_BENCHMARK__.drain()))
}
async function ready() {
  const states = await Promise.all(clients.map(c => c.page.evaluate(() => globalThis.__TARKMAN_BENCHMARK__.snapshot())))
  if (states.some(s => s.dropped)) throw new Error('Benchmark event buffer overflow; run is invalid.')
  if (states.some(s => s.visibility !== 'visible')) throw new Error('A client is hidden; foreground all benchmark windows.')
  const part = states[0]?.committed?.part_key
  return part && states.every(s => s.committed?.part_key === part && s.committed.connected && !s.committed.refreshing && !s.committed.stale && !s.committed.failed && s.committed.following) ? part : null
}
try {
  context = await chromium.launchPersistentContext(resolve(`${values.profile}-${values.fixture ? 'fixture' : 'production'}`), { channel: 'chrome', headless: !!values.headless,
    viewport: result.metadata.viewport, ignoreHTTPSErrors: !!values.fixture,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
  contexts.push(context)
  result.metadata.browser = context.browser().version()
  // No tracing/HAR/console capture: these can contain credentials or liturgy text.
  for (let index = 0; index <= readers; index++) {
    const client = index === 0 ? 'controller' : `reader_${index}`
    const ctx = index === 0 ? context : await context.browser().newContext({ viewport: result.metadata.viewport, ignoreHTTPSErrors: !!values.fixture })
    if (index) contexts.push(ctx)
    await ctx.addInitScript(installBridge, { run, client, sessionId: session })
    const page = index === 0 ? (ctx.pages()[0] || await ctx.newPage()) : await ctx.newPage()
    if (index === 0) {
      const html = await ctx.request.get(url)
      result.metadata.entry_html_sha256 = createHash('sha256').update(await html.body()).digest('hex')
    }
    page.setDefaultTimeout(timeout)
    page.setDefaultNavigationTimeout(60000)
    clients.push({ client, page })
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    const requests = new Map()
    cdp.on('Network.requestWillBeSent', event => {
      if (!event.request.url.startsWith(`${api}/`)) return
      const path = new URL(event.request.url).pathname
      if (!path.startsWith('/s/') && path !== '/services.json') return
      const headers = Object.fromEntries(Object.entries(event.request.headers).map(([k, v]) => [k.toLowerCase(), v]))
      const parent = requests.get(event.initiator?.requestId)?.row
      const row = { client, command: headers['x-tarkman-benchmark-command'] || parent?.command,
        cycle: headers['x-tarkman-benchmark-cycle'] || parent?.cycle, request: headers['x-tarkman-benchmark-request'] || parent?.request,
        method: event.request.method, path, status: null, timing: {}, sizes: { responseBodySize: 0 }, instrumented: false }
      requests.set(event.requestId, { row, started: event.timestamp })
      result.network.push(row)
    })
    cdp.on('Network.responseReceived', event => {
        const tracked = requests.get(event.requestId)
      if (!tracked) return
      const headers = Object.fromEntries(Object.entries(event.response.headers).map(([k, v]) => [k.toLowerCase(), v]))
      Object.assign(tracked.row, { status: event.response.status, timing: event.response.timing || {},
        instrumented: headers['x-tarkman-benchmark'] === '1', request_id: headers['x-request-id'],
        render_request_id: headers['rndr-id'], server_timing: headers['server-timing'] })
    })
    cdp.on('Network.dataReceived', event => {
      const tracked = requests.get(event.requestId)
      if (tracked) tracked.row.sizes.responseBodySize += event.dataLength
    })
    cdp.on('Network.loadingFinished', event => {
      const tracked = requests.get(event.requestId)
      if (!tracked) return
      tracked.row.timing.responseEnd = (event.timestamp - tracked.started) * 1000
      tracked.row.sizes.transferSize = event.encodedDataLength
      tracked.row.complete = true
    })
    cdp.on('Network.loadingFailed', event => {
      const tracked = requests.get(event.requestId)
      if (tracked) { tracked.row.failed = true; result.errors.push({ client, kind: 'request_failed', path: tracked.row.path }) }
    })
    console.log(`Opening ${client}`)
    await page.goto(`${url}/${index === 0 ? 'services' : 'sessions'}/${session}${index === 0 ? '' : '/parts'}`)
    console.log(`${client} route loaded`)
    if (index === 0) {
      if (values.fixture) {
        await page.waitForFunction(() => document.querySelector('[data-testid=control-next]') || document.querySelector('input[autocomplete=email]'))
        if (!await page.getByTestId('control-next').isVisible()) {
          await page.getByRole('textbox', { name: 'Email', exact: true }).fill('benchmark@example.test')
          await page.getByLabel('Password', { exact: true }).fill('fixture')
          await page.getByRole('button', { name: 'Sign in', exact: true }).click()
          await page.waitForURL(u => !u.pathname.includes('sign-in'))
        }
      } else {
        console.log('Sign in in the controller window if needed. The runner waits up to 5 minutes for the service controls.')
      }
      await page.getByTestId('control-next').waitFor({ timeout: values.fixture ? timeout : 300000 })
      console.log('Controller signed in')
    }
  }
  console.log('Waiting for matching reader snapshots')
  await waitFor(ready, 60000, 'all clients connected, idle, and showing the same part')
  console.log('Snapshots ready')
  await drain()
  initialKey = lastKey = await ready()
  result.initial_key = initialKey
  if (!values['client-only'] && !result.network.some(r => r.path === `/s/${session}.json` && r.instrumented)) {
    throw new Error('Backend instrumentation is not enabled for session 4008. Enable LATENCY_BENCHMARK_SESSION_IDS=4008 on web and worker, or explicitly use --client-only for an incomplete server breakdown.')
  }
  if (!values['prepare-only']) {
    console.log('Reading parts manifest')
    const partsResponse = await context.request.get(`${api}/s/${session}/parts.json`, { timeout, headers: { 'X-Polling-Client': 'true' } })
    const payload = await partsResponse.json()
    const parts = payload.parts.map(({ part: p }, i) => ({ id: p.id, key: p.liturgy_part_id ? `lp:${p.liturgy_part_id}` : `part:${p.id}:liturgy:${p.liturgy_id ?? null}:position:${p.position ?? i + 1}` })).filter(p => p.id)
    const startIndex = parts.findIndex(p => p.key === initialKey)
    if (startIndex < 0 || parts.length < 2) throw new Error('The starting occurrence is not identifiable in the parts response.')
    const outward = startIndex < parts.length - 1 ? 1 : -1
    for (let index = 0; index < warmup + samples; index++) {
      if (stop) break
      await waitFor(ready, timeout, 'clients idle before next command')
      if (await ready() !== lastKey) throw new Error('Session moved outside this run; stopping without restoring over another operator.')
      const target = parts[startIndex + (index % 2 === 0 ? outward : 0)]
      const direction = (index % 2 === 0 ? outward : -outward) === 1 ? 'next' : 'previous'
      console.log(`Starting sample ${index + 1}: ${direction}`)
      const command = randomUUID()
      await Promise.all(clients.map(c => c.page.evaluate(({ command, key }) => globalThis.__TARKMAN_BENCHMARK__.arm(command, key), { command, key: target.key })))
      const sample = { command, direction, warmup: index < warmup, target_key: target.key, target_part_id: target.id, outcome: 'pending' }
      result.samples.push(sample)
      await writeFile(`${output}/run.json`, JSON.stringify(result, null, 2))
      const began = performance.now()
      mutationUncertain = true
      const responsePromise = clients[0].page.waitForResponse(r => r.request().method() === 'POST' && r.url() === `${api}/s/${session}/${direction === 'next' ? 'next' : 'prev'}.json`, { timeout })
      await clients[0].page.getByTestId(`control-${direction}`).click()
      const response = await responsePromise
      sample.http_status = response.status()
      if (!response.ok()) { sample.outcome = 'rejected_or_unexpected'; throw new Error('Command was rejected or returned an unexpected part.') }
      await waitFor(async () => {
        await drain()
        return clients.every(c => result.events.some(e => e.command === command && e.client === c.client && e.name === 'ui.visible_estimate' && e.part_key === target.key))
      }, timeout, 'correct part visible on every client')
      await waitFor(async () => (await ready()) === target.key, timeout, 'all clients settled on the expected occurrence')
      await drain()
      const received = result.events.filter(e => e.command === command && e.name === 'cable.received' && e.event === 'part_change')
      if (received.some(e => e.part_id !== target.id || (e.event_command && e.event_command !== command) || (e.event_run && e.event_run !== run))) throw new Error('An unrelated part-change event overlapped this command.')
      const matched = clients.every(c => received.some(e => e.client === c.client && e.part_id === target.id && (values['client-only'] || (e.event_command === command && e.event_run === run))))
      sample.outcome = matched ? 'success' : 'recovered_without_matched_broadcast'
      lastKey = target.key; mutationUncertain = false
      console.log(`${index + 1}/${warmup + samples} ${direction}: ${sample.outcome}${sample.warmup ? ' (warmup)' : ''}`)
      await writeFile(`${output}/run.json`, JSON.stringify(result, null, 2))
      if (!matched) throw new Error('A reader recovered without the matching broadcast; stopping and retaining the failure.')
      await delay(Math.max(0, interval - (performance.now() - began)))
    }
  }
} catch (error) {
  console.error('Benchmark stopped:', error.message)
  result.errors.push({ kind: 'run_stopped', message: error.message })
  const sample = result.samples.at(-1)
  if (sample?.outcome === 'pending') sample.outcome = 'failed_or_timed_out'
  process.exitCode = 1
} finally {
  if (clients.length) await drain().catch(() => {})
  result.finished_at = new Date().toISOString()
  result.final_key = await ready().catch(() => null)
  result.position_restored = !!initialKey && result.final_key === initialKey && !mutationUncertain
  // Paired moves restore position on a normal run. On uncertainty, do not issue a blind corrective command.
  if (!result.position_restored && !values['prepare-only']) result.errors.push({ kind: 'position_requires_review', initial_key: initialKey, final_key: result.final_key, mutation_uncertain: mutationUncertain })
  await writeFile(`${output}/run.json`, JSON.stringify(result, null, 2))
  await writeReport(result, `${output}/report.html`)
  for (const ctx of contexts.reverse()) await ctx.close().catch(() => {})
  if (!values.fixture && !values['client-only'] && result.samples.length) {
    console.log('Collecting correlated Render web and worker logs')
    await delay(5000)
    try { console.log(JSON.stringify(await collectRender(result, output))) } catch (error) {
      result.errors.push({ kind: 'render_log_capture_failed', message: error.message })
      await writeFile(`${output}/run.json`, JSON.stringify(result, null, 2))
      await writeReport(result, `${output}/report.html`)
    }
  }
  console.log(`Report: ${output}/report.html`)
}
