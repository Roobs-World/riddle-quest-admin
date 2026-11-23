import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.env.REVIEW_FEEDBACK_REPORT_DIR??path.join(root,'artifacts/review-feedback-2026-10-25/solo'));
await mkdir(out,{recursive:true});
const artifact=path.resolve(process.env.PORTAL_JEST_BUILD_DIR??path.join(root,'builds/jest'));
const hosted=process.env.REVIEW_FEEDBACK_HOSTED_URL;
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const file=path.join(artifact,p==='/'?'index.html':p);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
if(!hosted)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const entry=hosted??'http://127.0.0.1:'+server.address().port+'/';
const origin=new URL(entry).origin;
const browser=await chromium.launch({headless:true,args:['--mute-audio']});
const results=[];
async function openCase(name){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.resourceType()==='media'||/\.(?:mp3|wav|ogg|webm|m4a)(?:\?|$)/.test(req.url()))return route.abort();if(url.origin!==origin)return route.fulfill({status:200,contentType:'application/javascript',body:''});return route.continue();});
 await context.addInitScript(()=>{
  HTMLMediaElement.prototype.play=function(){this.muted=true;return Promise.resolve();};
  Object.defineProperty(HTMLMediaElement.prototype,'muted',{get:()=>true,set:()=>{},configurable:true});
  for(const key of ['AudioContext','webkitAudioContext'])if(window[key]){const Original=window[key];window[key]=class extends Original{constructor(...args){super(...args);void this.suspend();}resume(){return Promise.resolve();}};}
  window.__RIDDLE_QUEST_BROWSER_TEST__=true;
  sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest','seen');
  localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest','seen');
  for(const id of ['submitAnswer','gameCoins','gameHint','gameSkip','gameMultiplayer','hintAfterWrongGuess','achievementEarned','leaderboardFifthCorrectAnswer','classicFromDaily'])localStorage.setItem('riddleQuest:tooltipSeen:'+id+':jest-guest','seen');
 });
 const page=await context.newPage();page.setDefaultTimeout(hosted?20000:6000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(entry+'?harness=jest&dailyCompleted=1');
 await page.getByRole('button',{name:/let's play/i}).click();
 await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
 await expect(page.locator('.riddle-card h1')).toContainText('What has keys');
 await page.evaluate(()=>{
  window.probe={sent:[],held:{}};
  const dispatch=window.dispatchEvent.bind(window);
  window.dispatchEvent=event=>{
   const message=event.detail;
   if(event.type==='riddle-quest:game-to-host')window.probe.sent.push(message);
   if(event.type==='riddle-quest:host-to-game'&&['spendCoins','completeGame'].includes(message?.payload?.operation)){window.probe.held[message.payload.operation]=message;return true;}
   return dispatch(event);
  };
  window.release=(kind,reject=false)=>{const held=window.probe.held[kind];if(!held)throw Error('Missing held '+kind);dispatch(new CustomEvent('riddle-quest:host-to-game',{detail:reject?{...held,payload:{operation:kind,ok:false,errorKind:'rejected',error:'Fixture rejected Continue'}}:held}));};
 });
 return {page,context,errors,name};
}
async function type(page,answer){for(const letter of answer)await page.locator('.keyboard').getByRole('button',{name:letter,exact:true}).click();}
async function exhaust(page){for(const letter of ['X','Z','Q','V','B']){await type(page,letter.repeat(5));await page.getByRole('button',{name:/^submit$/i}).click();await expect(page.locator('.guess-row .cell.red')).toHaveCount((['X','Z','Q','V','B'].indexOf(letter)+1)*5);}await expect(page.locator('.modal-continue')).toBeVisible();assert.equal(((await page.locator('.modal-continue').innerText()).match(/out of attempts/gi)??[]).length,1);}
async function attempt(caseName,fn){const c=await openCase(caseName);try{await fn(c.page);assert.deepEqual(c.errors,[]);results.push({case:caseName,passed:true});await c.page.screenshot({path:path.join(out,caseName+'.png')});}catch(error){results.push({case:caseName,passed:false,error:String(error),body:await c.page.locator('body').innerText().catch(()=>''),probe:await c.page.evaluate(()=>window.probe).catch(()=>null)});await c.page.screenshot({path:path.join(out,caseName+'-failed.png')});throw error;}finally{await c.context.close();}}
try{
 await attempt('coin-shop-copy',async page=>{await page.locator('.game-header .coin-pill').click();const products=page.locator('.game-shop-grid article:not(.shop-subscription-card)');await expect(products.first()).toBeVisible();assert.ok(await products.count()>0);for(const product of await products.all()){const text=await product.innerText();assert.doesNotMatch(text,/add.*coins.*balance/i);assert.match(text,/coins/i);assert.match(text,/[£$€]|USD|GBP/);} });
 await attempt('continue-queued-submit',async page=>{
  await exhaust(page);await page.locator('.loss-continue-action').click();await page.waitForFunction(()=>window.probe.held.spendCoins);
  await type(page,'PIANO');const submit=page.getByRole('button',{name:/^submit$/i});await expect(submit).toBeEnabled();
  await submit.click();await expect(page.locator('.submit-action')).toHaveAttribute('aria-busy','true');
  assert.equal(await page.evaluate(()=>window.probe.sent.filter(m=>m.type==='game:submitGuess').length),5);
  await page.evaluate(()=>window.release('spendCoins'));
  await expect(page.locator('.modal-victory')).toBeVisible();
  assert.equal(await page.evaluate(()=>window.probe.sent.filter(m=>m.type==='game:submitGuess').length),6);
 });
 await attempt('continue-rejection-cancels-submit',async page=>{
  await exhaust(page);await page.locator('.loss-continue-action').click();await page.waitForFunction(()=>window.probe.held.spendCoins);
  await type(page,'PIANO');await page.getByRole('button',{name:/^submit$/i}).click();await page.evaluate(()=>window.release('spendCoins',true));
  await expect(page.locator('.modal-continue')).toBeVisible();
  assert.equal(await page.evaluate(()=>window.probe.sent.filter(m=>m.type==='game:submitGuess').length),5);
 });
 await attempt('continue-draft-edit-cancels-submit',async page=>{
  await exhaust(page);await page.locator('.loss-continue-action').click();await page.waitForFunction(()=>window.probe.held.spendCoins);
  await type(page,'PIANO');await page.getByRole('button',{name:/^submit$/i}).click();
  await page.locator('.keyboard').getByRole('button',{name:'Backspace',exact:true}).click();
  await page.evaluate(()=>window.release('spendCoins'));
  await expect(page.locator('.submit-action')).not.toHaveAttribute('aria-busy','true');
  assert.equal(await page.evaluate(()=>window.probe.sent.filter(m=>m.type==='game:submitGuess').length),5);
 });
 await attempt('classic-next-before-completion-ack',async page=>{
  await type(page,'PIANO');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.held.completeGame);
  const next=page.getByRole('button',{name:/^next level$/i});await expect(next).toBeEnabled();await next.click();
  await expect(page.locator('.riddle-card h1')).toContainText('face and hands');
  assert.equal(await page.evaluate(()=>Boolean(window.probe.held.completeGame)),true);
 });
}finally{await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'browser-results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results.map(({case:name,passed,error})=>({case:name,passed,error})),null,2));}
