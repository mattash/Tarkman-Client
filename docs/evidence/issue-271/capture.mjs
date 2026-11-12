import { createRequire } from 'node:module'
import http from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Real exported repository app. Only its anonymous HTTP API is a deterministic fixture.
const [root, label, expected, revision] = process.argv.slice(2)
if (!root || !label || !expected || !revision) throw Error('Usage: node capture.mjs EXPORT_DIR LABEL EXPECTED_TEXT REVISION')
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.EVIDENCE_OUTPUT_DIR || process.cwd()
const requests = []
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:18771')
  if (url.pathname.startsWith('/public/')) {
    requests.push({ method: req.method, path: url.pathname + url.search, status: 429, body: 'Too many requests', retryAfter: '60' })
    res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '60', 'Cache-Control': 'no-store' }); res.end('Too many requests'); return
  }
  try {
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '')
    let file = path.resolve(root, relative)
    if (!file.startsWith(path.resolve(root) + path.sep)) throw Error('not a resource')
    let data
    try { data = await readFile(file) } catch { file = path.join(root, 'index.html'); data = await readFile(file) }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data)
  } catch { res.writeHead(404); res.end('Not found') }
})
await new Promise(resolve => server.listen(18771, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light', timezoneId: 'UTC', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message) })
  page.on('request', req => console.log('REQUEST', req.method(), req.url()))
  page.on('console', msg => { if (msg.type() === 'error') console.error('BROWSER', msg.text()) })
  await page.goto('http://127.0.0.1:18771/library', { waitUntil: 'domcontentloaded' })
  await page.getByText(expected, { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: false })
  await writeFile(`${output}/${label}.json`, JSON.stringify({ label, revision, url: page.url(), viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light', timezoneId: 'UTC', storage: 'new anonymous browser context, no saved copies', scenario: 'Initial Prayer Library focus; all catalog API calls respond HTTP 429 text/plain Too many requests with Retry-After: 60; screenshot before retry expiry', browser: browser.version(), requests, errors, visibleText: await page.locator('body').innerText() }, null, 2))
  console.log(JSON.stringify({ screenshot: `${output}/${label}.png`, requests, errors }))
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
