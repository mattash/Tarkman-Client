/* global process, console, URL, window, document, getComputedStyle */
// Run with Playwright available in the review environment; never points at a real service.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const app = process.env.DISPLAY_REVIEW_APP || 'http://localhost:8082'
if (!['localhost', '127.0.0.1'].includes(new URL(app).hostname)) throw new Error('Loopback app required')
;(async () => {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const [a1, a2, b, manager] = await Promise.all(Array.from({ length: 4 }, () => context.newPage()))
    const displays = [a1, a2, b]
    let forbidReads = false, forbiddenReads = 0
    for (const page of displays) {
      await page.route('**/display_links/*', route => {
        if (forbidReads) { forbiddenReads++; return route.abort() }
        return route.continue()
      })
    }
    await Promise.all(displays.map((page, index) => page.goto(`${app}/sessions/display?token=token-${index === 2 ? 'B' : 'A'}`)))
    for (const page of displays) await page.getByTestId('display-projection-text').waitFor()
    const font = page => page.getByTestId('display-projection-text').locator('[data-testid="projection-text-scroll"]').first().evaluate(element => {
      const text = [...element.querySelectorAll('*')].filter(node => node.textContent.includes('Hayr mer'))
      return Math.max(0, ...text.map(node => Number.parseFloat(getComputedStyle(node).fontSize)))
    })
    const before = await Promise.all(displays.map(font)); assert(before.every(size => size > 0))
    // A sentinel proves the document was not reloaded, while blocked GETs isolate the socket path.
    for (const page of displays) await page.evaluate(() => { window.__displayReviewSentinel = 173 })
    await manager.goto(`${app}/display-links`)
    await manager.getByLabel('Email', { exact: true }).fill('operator@display.test')
    await manager.getByLabel('Password', { exact: true }).fill('fixture')
    await manager.getByRole('button', { name: 'Sign in', exact: true }).click()
    await manager.getByRole('button', { name: 'Edit Sanctuary A', exact: true }).click()
    await manager.getByRole('button', { name: 'Increase text size', exact: true }).waitFor()
    for (let i = 0; i < 6; i++) await manager.getByRole('button', { name: 'Increase text size', exact: true }).click()
    forbidReads = true
    const saved = manager.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/display_links/token-A') && response.ok())
    await manager.getByRole('button', { name: 'Save changes', exact: true }).click()
    await saved
    const acknowledged = Date.now()
    for (let index = 0; index < 2; index++) {
      await displays[index].waitForFunction(([size]) => {
        const region = document.querySelector('[data-testid="display-projection-text"]')
        const text = region ? [...region.querySelectorAll('*')].filter(node => node.textContent.includes('Hayr mer')) : []
        return Math.max(0, ...text.map(node => Number.parseFloat(getComputedStyle(node).fontSize))) >= size * 1.29
      }, [before[index]], { timeout: 2000 })
    }
    assert.equal(await font(b), before[2])
    for (const page of displays) assert.equal(await page.evaluate(() => window.__displayReviewSentinel), 173)
    console.log(JSON.stringify({ adoptionAfterSaveMs: Date.now() - acknowledged, canonicalReadsBlocked: forbiddenReads, unaffectedB: true }))
  } finally { await browser.close() }
})().catch(() => { console.error('Synthetic display manager review failed; inspect locally without recording capability URLs.'); process.exitCode = 1 })
