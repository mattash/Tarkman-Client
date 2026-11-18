const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const phase = process.env.QA_PHASE || 'before';
const app = process.env.QA_APP || 'http://localhost:8082';
const output = process.env.QA_OUTPUT || '/tmp/library274-evidence';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM,headless:true});
 const results=[];
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,colorScheme:'light',locale:'en-US',timezoneId:'America/Los_Angeles'});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app+'/liturgies/701',{timeout:180000});
  await page.getByText('Peace',{exact:true}).first().waitFor({timeout:120000});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${output}/${phase}-web-${viewport.width}-light.png`});
  results.push({viewport,text:await page.locator('body').innerText(),errors});await context.close();
 }
 fs.writeFileSync(`${output}/${phase}-web.json`,JSON.stringify({phase,app,results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
