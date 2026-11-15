/* global console, process, URL, __dirname, document, innerWidth */
// Requires an external Playwright install; never contacts production services.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const base = process.env.QA_BASE_URL || 'http://localhost:18383'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the isolated loopback Expo server')
const output = process.env.QA_OUTPUT_DIR || path.join(__dirname, 'evidence')

async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  const results = []
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
    await page.goto(`${base}/settings`)
    const appearance = page.getByRole('radiogroup', { name: 'Appearance', exact: true })
    const system = appearance.getByRole('radio', { name: 'Appearance, System', exact: true })
    await system.waitFor()
    assert.equal(await appearance.locator('[tabindex="0"]').count(), 1)
    await system.focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Appearance, Light' && document.activeElement?.getAttribute('aria-checked') === 'true')
    await page.screenshot({ path: path.join(output, 'keyboard-after.png') })
    await page.keyboard.press('End')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Appearance, Dark')
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Appearance, System')
    await page.keyboard.press('Tab')
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Reading size, Standard')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Appearance, System')
    results.push('390px: one tab stop, ArrowRight selection/focus, End, wrap, Tab/Shift+Tab')

    await page.setViewportSize({ width: 320, height: 844 })
    await page.waitForFunction(() => document.querySelector('[role="radiogroup"][aria-label="Appearance"]')?.getAttribute('aria-orientation') === 'vertical')
    await system.focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Appearance, Light')
    assert.equal(await appearance.getAttribute('aria-orientation'), 'vertical')
    results.push('320px stacked: ArrowDown selection/focus')

    await page.goto(`${base}/gallery`)
    const field = page.getByRole('textbox', { name: 'Field with feedback', exact: true })
    await field.waitFor()
    assert.equal(await field.getAttribute('aria-invalid'), 'true')
    const description = await field.getAttribute('aria-describedby')
    assert.ok(description)
    assert.equal(await page.locator(`[id="${description}"]`).innerText(), 'This sample is read-only.')
    results.push('Gallery field: actual DOM invalid state and exact error association')
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme })
        assert.ok(await page.getByText('Հա́յր մեր։ Տէ՛ր, ողորմեա՜։ Ինչո՞ւ։ Ա̄ ա́', { exact: true }).count())
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      }
    }
    results.push('Gallery 390/820/1440 light/dark: multilingual stress sample present, no document horizontal overflow (not a glyph-shaping or native accessibility certification)')
    await page.close()

    const today = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
    await today.route('**/services.json?*', async route => {
      const response = await route.fetch()
      const first = (await response.json())[0]
      assert.equal(first.session.id, 9001, 'Use the synthetic design-system fixture')
      await route.fulfill({ json: [first, { session: { ...first.session, id: 9002, liturgy: 'Second sample service · paused', church_name: 'Second sample parish', status: 'paused' } }] })
    })
    await today.goto(`${base}/`)
    await today.getByRole('button', { name: 'Second sample service · paused, Second sample parish', exact: true }).waitFor()
    assert.equal(await today.getByRole('button', { name: /paused.*live now/ }).count(), 0)
    await today.getByRole('heading', { name: 'Services', exact: true }).waitFor()
    await today.screenshot({ path: path.join(output, 'today-after.png') })
    results.push('Today mixed active/paused: paused service has no live name; neutral Services heading; active service remains live')
    assert.equal(await today.getByRole('button', { name: /Sample Divine Liturgy.*live now/ }).count(), 1)
    console.log(JSON.stringify({ browser: browser.version(), results }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
