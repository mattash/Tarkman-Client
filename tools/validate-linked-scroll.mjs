#!/usr/bin/env node
/**
 * Render the production Expo web export with controlled read-only API fixtures.
 * Install Playwright outside the repo, e.g. npm i --prefix /tmp/scroll-tools playwright.
 * PLAYWRIGHT_MODULE=/tmp/scroll-tools/node_modules/playwright/index.mjs \
 *   node tools/validate-linked-scroll.mjs /absolute/export/directory after default
 * Export with EXPO_PUBLIC_API_URL=https://fixture.tarkman.test and
 * EXPO_PUBLIC_ACTIONCABLE_URL=wss://fixture.tarkman.test/cable; pass --clear to Expo
 * when changing these variables (Metro's cache can retain the old environment).
 * Chrome must be installed. No production server, auth or service mutations used.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const [distArgument, label = 'after', scenario = 'default'] = process.argv.slice(2)
if (!distArgument) throw new Error('Usage: node tools/validate-linked-scroll.mjs EXPORT_DIR LABEL [default|swap|stacked|reflow|background|fallback|independent|paged|manual|fitting]')
const dist = path.resolve(distArgument)
const out = path.resolve(process.env.SCROLL_EVIDENCE_DIR || '/tmp/linked-scroll-evidence')
fs.mkdirSync(out, { recursive: true })
const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(req.url.split('?')[0]))
  if (!file.startsWith(`${dist}/`)) { res.writeHead(400); res.end(); return }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.setHeader('content-type', ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream')
  res.end(fs.readFileSync(file))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: scenario === 'stacked' ? { width: 600, height: 1080 } : { width: 1920, height: 1080 }, reducedMotion: 'no-preference' })
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(String(error)))
  // Six ordered landmarks with deliberately unequal language expansion. These
  // are synthetic text blocks, not a claim of phrase-level speech tracking.
  const landmarks = ['OPENING', 'MERCY', 'PRAISE', 'PEACE', 'BLESSING', 'CLOSING']
  const translit = landmarks.map((word, index) => `${word} ${index + 1}. Der voghormia, Der voghormia. Orhnyal e Astvats.`).join('\n\n')
  const english = landmarks.map((word, index) => `${word} ${index + 1}. Lord, have mercy upon us, and grant peace to all your people. Blessed be the kingdom of the Father and of the Son and of the Holy Spirit.`).join('\n\n')
  const config = {
    token: 'fixture259', user_id: 2, config_version: 1, mode: 'parallel',
    lang1: scenario === 'swap' ? 'en' : 'translit', lang2: scenario === 'swap' ? 'translit' : 'en',
    show_explanations: false, show_notifications: true, status_view: 'none',
    text_movement: ['manual', 'paged'].includes(scenario) ? scenario : 'continuous',
    language_sync: scenario === 'independent' ? 'independent' : 'linked',
    device_type: 'projector', font_scale: 75, margin_percent: 4,
  }
  const session = {
    id: 259, liturgy: 'Controlled unequal linked reading', church_name: 'Fixture',
    current_part_id: 1, current_liturgy_id: 1, current_liturgy_part_id: 2591,
    current_part_position: 1, status: 'active', status_message: null, revision: 1,
    posture: null, date: '2026-11-06', num_of_parts: 1, liturgies: [{ id: 1 }], options: {},
  }
  const part = { id: 1, liturgy_id: 1, liturgy_part_id: 2591, position: 1, role: 'reader',
    en: english, translit: scenario === 'fitting' ? 'OPENING. Der voghormia. CLOSING.' : translit,
    effective_duration_ms: scenario === 'fallback' ? null : 60000 }
  await page.route('https://fixture.tarkman.test/**', async route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    let data
    if (url.pathname.includes('display_links')) data = config
    else if (url.pathname.includes('parts')) data = { parts: [{ part }] }
    else if (url.pathname.includes('explanations')) data = { explanations: [] }
    else if (url.pathname.endsWith('state.json')) data = { session: {
      id: 259, revision: 1, content_context: 'fixture259',
      cursor: { part_id: 1, liturgy_part_id: 2591, liturgy_id: 1, position: 1 },
      status: session.status, status_message: null, posture: null, date: session.date,
    } }
    else data = { session }
    await route.fulfill({ json: data })
  })
  await page.routeWebSocket(/fixture\.tarkman\.test/, () => {})
  await page.clock.install()
  await page.goto(`http://127.0.0.1:${server.address().port}/sessions/259/display?token=fixture259`)
  try { await page.getByTestId('display-projection').waitFor() }
  catch (error) { throw new Error(`${error}\n${await page.locator('body').innerText()}\n${JSON.stringify({ requests, errors })}`) }
  await page.evaluate(() => document.fonts.ready)
  await page.clock.pauseAt(new Date(Date.now() + 100))
  const start = await page.evaluate(() => performance.now())
  const snapshot = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="projection-text-scroll"]')).map(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const style = getComputedStyle(walker.nextNode()?.parentElement || element)
    return {
      y: element.scrollTop, viewport: element.clientHeight, content: element.scrollHeight,
      max: element.scrollHeight - element.clientHeight, width: element.clientWidth,
      fontSize: style.fontSize, lineHeight: style.lineHeight, fontFamily: style.fontFamily,
      visibleLandmarks: ['OPENING', 'MERCY', 'PRAISE', 'PEACE', 'BLESSING', 'CLOSING'].filter(word => {
        const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node
        while ((node = text.nextNode())) {
          const index = node.textContent.indexOf(word)
          if (index < 0) continue
          const range = document.createRange()
          range.setStart(node, index); range.setEnd(node, index + word.length)
          const rect = range.getBoundingClientRect(), viewport = element.getBoundingClientRect()
          if (rect.bottom > viewport.top && rect.top < viewport.bottom) return true
        }
        return false
      }),
    }
  }))
  const initial = await snapshot()
  const endpoints = [null, null], firstMoves = [null, null], lastMoves = [null, null]
  const lastYs = initial.map(column => column.y), observations = [], lifecycle = []
  const capture = suffix => page.screenshot({ path: path.join(out, `${label}-${scenario}-${suffix}.png`) })
  await capture('opening')
  const duration = part.effective_duration_ms ?? Math.max(...[part.en, part.translit].map(text => text.trim().split(/\s+/).length)) / 160 * 60000
  const end = Math.ceil((duration + 1000) / 100) * 100
  for (let elapsed = 100; elapsed <= end; elapsed += 100) {
    await page.clock.runFor(100)
    if (elapsed === 30000 && scenario === 'reflow') {
      lifecycle.push({ event: 'before-mid-reflow', columns: await snapshot() })
      await page.setViewportSize({ width: 1600, height: 900 })
      await new Promise(resolve => setTimeout(resolve, 100))
      await page.clock.runFor(32)
      lifecycle.push({ event: 'after-mid-reflow', columns: await snapshot() })
    }
    if (elapsed === 30000 && scenario === 'background') {
      lifecycle.push({ event: 'before-background', columns: await snapshot() })
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
      await page.clock.runFor(5000)
      lifecycle.push({ event: 'after-5s-background', columns: await snapshot() })
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
    }
    const columns = await snapshot()
    columns.forEach((column, index) => {
      if (firstMoves[index] === null && column.y > 0) firstMoves[index] = elapsed
      if (Math.abs(column.y - lastYs[index]) > .001) lastMoves[index] = elapsed
      lastYs[index] = column.y
      if (endpoints[index] === null && column.max > 0 && Math.abs(column.max - column.y) < .01) endpoints[index] = elapsed
    })
    if ([10000, 30000, 45000, 50000, 55000, 60000].includes(elapsed)) {
      observations.push({ elapsedMs: elapsed, columns }); await capture(elapsed)
    }
  }
  if (scenario === 'reflow') {
    lifecycle.push({ event: 'before-completed-reflow', columns: await snapshot() })
    await page.setViewportSize({ width: 1920, height: 1080 })
    await new Promise(resolve => setTimeout(resolve, 100))
    await page.clock.runFor(100)
    lifecycle.push({ event: 'after-completed-reflow', columns: await snapshot() })
    await capture('completed-reflow')
  }
  const checks = {
    noBrowserErrors: errors.length === 0,
    overflowingLinkedEndpointsTogether: config.language_sync === 'linked' && config.text_movement === 'continuous' && initial.every(column => column.max > 0)
      ? endpoints.every(value => value !== null) && Math.abs(endpoints[0] - endpoints[1]) <= 100 : null,
    manualStationary: scenario === 'manual' ? firstMoves.every(value => value === null) : null,
    fittingStationary: scenario === 'fitting' ? firstMoves[0] === null : null,
    backgroundStationary: scenario === 'background' ? lifecycle[0].columns.every((column, index) => column.y === lifecycle[1].columns[index].y) : null,
    completedReflowAtBottom: scenario === 'reflow' ? lifecycle.at(-1).columns.every(column => Math.abs(column.y - column.max) <= 1) : null,
  }
  const result = { label, scenario, checks, measurement: '100ms sampling after fonts ready; relative to start, not server reading time', start,
    config, reducedMotion: false, viewport: page.viewportSize(), session, part, durationMs: duration,
    durationSource: part.effective_duration_ms ? 'API effective_duration_ms' : 'longest-language 160wpm fallback',
    initial, firstMoves, lastMoves, endpoints, observations, lifecycle, requests: [...new Set(requests)], errors }
  fs.writeFileSync(path.join(out, `${label}-${scenario}.json`), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({ label, scenario, checks, initial, firstMoves, lastMoves, endpoints, lifecycle, errors }, null, 2))
  if (label !== 'baseline' && Object.values(checks).some(value => value === false)) process.exitCode = 1
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
