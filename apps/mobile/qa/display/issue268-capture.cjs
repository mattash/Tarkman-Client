/* global process, URL, fetch, document, innerWidth, console */
// Actual Expo web captures against synthetic loopback fixture only.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const app = process.env.QA_APP || 'http://127.0.0.1:8082'
const phase = process.env.QA_PHASE || 'before'
const output = path.resolve('docs/evidence/issue-268')
if (!['localhost', '127.0.0.1'].includes(new URL(app).hostname)) throw Error('Loopback only')
const executablePath = process.env.QA_CHROMIUM
;(async () => {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ executablePath })
  const results = []
  try {
    for (const scenario of [
      { name: 'form-desktop-light', width: 1440, height: 1100, theme: 'light', route: '/session-management/9001/edit', scroll: 'Readings and messages' },
      { name: 'form-phone-dark', width: 390, height: 844, theme: 'dark', route: '/session-management/9001/edit', scroll: 'Gospel reading' },
      { name: 'operator-phone-light', width: 390, height: 844, theme: 'light', route: '/services/9001/service' },
      { name: 'display-kiosk-dark', width: 1920, height: 1080, theme: 'dark', route: '/sessions/display?token=token-A', display: true },
    ]) {
      await fetch('http://127.0.0.1:8101/qa/reset', { method: 'POST' })
      if (scenario.display) await fetch('http://127.0.0.1:8101/review/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'showing_prophetic' }) })
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, colorScheme: scenario.theme, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'America/Los_Angeles' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(app + scenario.route)
      if (!scenario.display) {
        await page.getByLabel('Email', { exact: true }).fill('operator@display.test')
        await page.getByLabel('Password', { exact: true }).fill('fixture')
        await page.getByRole('button', { name: 'Sign in', exact: true }).click()
        await page.getByText(scenario.name.startsWith('form') ? 'Service date' : 'WHAT THE CONGREGATION SEES', { exact: true }).waitFor()
      } else await page.waitForTimeout(1800)
      await page.evaluate(() => document.fonts.ready)
      if (scenario.scroll) await page.getByText(scenario.scroll, { exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(400)
      const text = await page.locator('body').innerText()
      await page.screenshot({ path: path.join(output, `${phase}-${scenario.name}.png`) })
      results.push({ ...scenario, text, errors, overflow: await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })) })
      await context.close()
    }
    fs.writeFileSync(path.join(output, `${phase}-capture.json`), JSON.stringify({ app, phase, browser: browser.version(), results }, null, 2))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
