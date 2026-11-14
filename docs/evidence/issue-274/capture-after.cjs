const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright')
const fs = require('node:fs'), path = require('node:path')
const app = process.env.QA_APP || 'http://localhost:8083'
const output = process.env.QA_OUTPUT || path.resolve('docs/evidence/issue-274')
;(async () => {
 const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM })
 const results = []
 try {
 for (const width of [390, 1440]) {
 const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US', timezoneId: 'America/Los_Angeles' })
 const page = await context.newPage(), errors = []
 page.on('pageerror', error => errors.push(error.message))
 await page.goto(app + '/liturgies/701', { timeout: 180000 })
 await page.getByText('Peace', { exact: true }).first().waitFor({ timeout: 120000 })
 await page.evaluate(() => document.fonts.ready)
 await page.screenshot({ path: `${output}/after-web-${width}-light.png` })
 await page.getByRole('button', { name: 'Find in text', exact: true }).click()
 const input = page.getByRole('textbox', { name: 'Find in text', exact: true })
 await input.fill('Peace')
 await page.getByText('1 of 2 matches', { exact: true }).waitFor()
 await page.screenshot({ path: `${output}/after-web-${width}-find-first.png` })
 await input.press('Enter')
 await page.getByText('2 of 2 matches', { exact: true }).waitFor()
 await page.screenshot({ path: `${output}/after-web-${width}-find-second.png` })
 await page.getByRole('button', { name: 'Next match', exact: true }).click()
 await page.getByText('1 of 2 matches', { exact: true }).waitFor()
 await input.focus(); await input.press('Escape')
 await input.waitFor({ state: 'hidden' })
 await page.getByRole('button', { name: 'Find in text', exact: true }).click()
 await input.fill('absent-word')
 await page.getByText('No matches in this reading language.', { exact: true }).waitFor()
 results.push({ width, errors, keyboardEnter: 'second occurrence', nextWrap: 'first occurrence', escape: 'closed find', noMatch: 'explicit empty state' })
 await context.close()
 }
 fs.writeFileSync(`${output}/after-web.json`, JSON.stringify({ app, results }, null, 2))
 } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
