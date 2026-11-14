const {chromium}=require(process.env.QA_PLAYWRIGHT||'/tmp/issue-271-evidence/harness/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const app=process.env.QA_APP||'http://localhost:8097',phase=process.env.QA_PHASE||'after',output=__dirname;
const long=process.env.QA_LONG==='1';
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const results=[];for(const width of (process.env.QA_WIDTHS||'390,320,1440').split(',').map(Number)){
const viewport={width,height:width===1440?900:844},context=await browser.newContext({viewport,deviceScaleFactor:1,colorScheme:'light',locale:'en-US',timezoneId:'America/Los_Angeles'}),page=await context.newPage(),errors=[],consoleErrors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
if(long)await page.route('**/public/liturgies/701/download.json',async route=>{const response=await route.fetch(),bundle=await response.json();bundle.parts[0].text.en=Array.from({length:70},(_,i)=>`Synthetic paragraph ${i+1}. This is a long local reading fixture with ordinary words and a distinct numbered place for resume evidence.`).join('\n\n');delete bundle.revision;bundle.revision=crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex');await route.fulfill({response,json:bundle})});
await page.goto(app+'/liturgies/701',{timeout:180000});await page.getByText(long?/Synthetic paragraph 1\./:'Peace',{exact:!long}).first().waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);
const result={viewport,errors,consoleErrors,initial:await page.locator('body').innerText()};
await page.screenshot({path:path.join(output,`${phase}-web-${width}-${long?'long-initial':'light'}.png`)});
if(process.env.QA_INTERACT==='1'){
if(width===320){await page.getByTestId('library-reader-preferences').click();await page.getByRole('radio',{name:/, Larger$/,exact:false}).click();await page.getByRole('button',{name:/^Close /}).click();await page.screenshot({path:path.join(output,`${phase}-web-${width}-larger.png`)})}
await page.mouse.move(width/2,600);await page.mouse.wheel(0,long?4700:300);await page.waitForTimeout(1200);
result.scrolled=await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.scrollTop>0).map(e=>({testid:e.getAttribute('data-testid'),top:e.scrollTop,height:e.scrollHeight})));
await page.screenshot({path:path.join(output,`${phase}-web-${width}-scrolled.png`)});
await page.getByTestId('library-reader-preferences').click();await page.getByTestId('modal-content').getByRole('button',{name:'Saved passages',exact:true}).click();
await page.getByRole('button',{name:'Bookmark this passage',exact:true}).click();await page.getByRole('button',{name:/Passage 1/}).waitFor();result.saved=await page.locator('body').innerText();result.readingStorage=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('library-reading'))));await page.screenshot({path:path.join(output,`${phase}-web-${width}-saved.png`)});
await page.getByRole('button',{name:/^Close /}).click();await page.reload();await page.getByTestId('library-resume').waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,`${phase}-web-${width}-reopened.png`)});
await page.getByTestId('library-resume').click();await page.waitForTimeout(1200);result.resume=await page.evaluate(()=>({anchors:Array.from(document.querySelectorAll('[data-testid="passage-highlight-anchor"]')).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),scroll:Array.from(document.querySelectorAll('*')).filter(e=>e.scrollTop>0).map(e=>e.scrollTop)}));await page.screenshot({path:path.join(output,`${phase}-web-${width}-resumed.png`)});
}
results.push(result);fs.writeFileSync(path.join(output,`${phase}-${long?'long':'web'}.json`),JSON.stringify({phase,app,long,results},null,2));await context.close();} }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
