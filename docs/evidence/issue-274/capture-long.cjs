const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright')
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const app = process.env.QA_APP || 'http://localhost:8083', output = process.env.QA_OUTPUT || path.resolve('docs/evidence/issue-274')
;(async () => {
 const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM })
 try {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'America/Los_Angeles' })
 const page = await context.newPage(), errors=[]
 page.on('pageerror', error=>errors.push(error.message))
 // Deliberately derived synthetic QA payload only; real application rendering/navigation.
 await page.route('**/public/liturgies/701/download.json', async route => {
 const response = await route.fetch(), bundle = await response.json()
 bundle.parts[0].text.en = Array.from({length:100}, (_, i) => `Synthetic paragraph ${i + 1}. This is a long local reading fixture with ordinary words.`).join('\n\n') + '\n\nExact passage lantern appears here.\n\nFinal synthetic paragraph.'
 delete bundle.revision; bundle.revision=crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex')
 await route.fulfill({response,json:bundle})
 })
 await page.goto(app+'/liturgies/701',{timeout:180000})
 await page.getByText(/Synthetic paragraph 1\./).first().waitFor({timeout:120000})
 await page.getByRole('button',{name:'Find in text',exact:true}).click()
 await page.getByRole('textbox',{name:'Find in text',exact:true}).fill('lantern')
 await page.getByText('1 of 1 matches',{exact:true}).waitFor()
 const anchor=page.getByTestId('passage-highlight-anchor')
 await anchor.waitFor()
 // Wait for measured glyph alignment, not just occurrence-row mounting.
 await page.waitForFunction(()=>{const a=document.querySelector('[data-testid="passage-highlight-anchor"]');if(!a)return false;const r=a.getBoundingClientRect();return r.top>=100&&r.bottom<=innerHeight})
 await page.evaluate(()=>document.fonts.ready)
 const bounds=await anchor.boundingBox()
 await page.screenshot({path:`${output}/after-web-390-long-passage.png`})
 fs.writeFileSync(`${output}/after-long.json`,JSON.stringify({app,viewport:{width:390,height:844},syntheticParagraphs:100,query:'lantern',bounds,errors},null,2))
 await context.close()
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
