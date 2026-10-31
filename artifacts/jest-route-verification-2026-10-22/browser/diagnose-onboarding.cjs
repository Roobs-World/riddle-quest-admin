const {createRequire}=require('node:module');
const path=require('node:path');
const fs=require('node:fs/promises');
const {createServer}=require('node:http');
const requirePortal=createRequire(path.resolve('packages/portal/package.json'));
const {chromium}=requirePortal('@playwright/test');
const output=path.resolve('artifacts/jest-route-verification-2026-10-22/browser');
const dist=path.join(output,'jest-artifact');
(async()=>{
 const server=createServer(async(req,res)=>{try {const p=new URL(req.url,'http://localhost').pathname;const f=path.join(dist,p==='/'?'index.html':p);res.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':f.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await fs.readFile(f));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:459,height:591}});
  await page.route('https://cdn.jest.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.addInitScript(()=>{window.__RIDDLE_QUEST_BROWSER_TEST__=true;});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?harness=jest&dailyCompleted=1');
  await page.getByRole('button',{name:/let's play/i}).click();
  await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
  await page.waitForTimeout(1200);
  const guest=page.getByRole('button',{name:/play as guest/i});if(await guest.isVisible())await guest.click();
  await page.waitForTimeout(800);
  await page.screenshot({path:path.join(output,'onboarding-first-tooltip.png'),fullPage:true});
  const observed=await page.evaluate(()=>({tooltip:document.querySelector('.tooltip-card')?.textContent,heading:document.querySelector('.riddle-text')?.textContent,body:document.body.innerText}));
  await fs.writeFile(path.join(output,'onboarding-observation.json'),JSON.stringify(observed,null,2)+'\n');
  console.log(JSON.stringify(observed,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
