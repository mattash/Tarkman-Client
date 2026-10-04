/* global console, process, getComputedStyle */
// Synthetic loopback rendering check; Eastern text comes from tests/part-detail.test.tsx.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];page.on('pageerror', e=>errors.push(e.message));
 let eastern='Ալելուիա';
 await page.route('**/s/9001/parts.json*',async route=>{const r=await route.fetch();const data=await r.json();for(const row of data.parts){row.part.hy_east=eastern;row.part.hy_west='Western only';}await route.fulfill({response:r,json:data});});
 await page.route('**/display_links/token-A', async route=>{const r=await route.fetch();const data=await r.json();Object.assign(data,{mode:'parallel',lang1:'hye',lang2:'en'});if(data.display_link)Object.assign(data.display_link,{mode:'parallel',lang1:'hye',lang2:'en'});await route.fulfill({response:r,json:data});});
 await page.goto('http://localhost:8082/sessions/9001/display?token=token-A');
 await page.getByText('Ալելուիա',{exact:true}).waitFor({timeout:90000});
 await page.getByText('Our Father, who art in heaven,',{exact:false}).first().waitFor();
 const font=await page.getByText('Ալելուիա',{exact:true}).evaluate(el=>getComputedStyle(el).fontFamily);
 assert.match(font,/NotoSerifArmenian/);assert.equal(await page.getByText('Western only',{exact:true}).count(),0);
 await page.screenshot({path:'apps/mobile/qa/eastern-armenian/parallel.png'});
 eastern='   ';
 await page.goto('http://localhost:8082/sessions/9001/display?mode=single&lang1=hye');
 await page.getByText('No text is available in the selected language.',{exact:true}).waitFor();
 assert.equal(await page.getByText('Western only',{exact:true}).count(),0);
 await page.screenshot({path:'apps/mobile/qa/eastern-armenian/missing.png'});
 assert.deepEqual(errors,[]);
 console.log('Token/API Eastern Armenian and parallel English render with Armenian font; direct single hye missing state has no fallback; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
