import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
const require=createRequire(path.resolve('packages/portal/package.json'));
const {chromium,firefox}=require('@playwright/test');
const evidence=path.resolve('artifacts/host-player-latency-2026-10-08');
const roots={baseline:path.resolve('artifacts/host-expired-riddle-2026-10-08/built/jest'),current:path.resolve('artifacts/host-startup-work-2026-10-08/built/jest')};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
await mkdir(evidence,{recursive:true});const results=[];let browser;
const server=createServer(async(req,res)=>{try{const segments=new URL(req.url,'http://localhost').pathname.split('/').filter(Boolean),side=segments.shift();if(!roots[side])throw new Error('unknown side');const file=path.resolve(roots[side],segments.join('/')||'index.html');if(!file.startsWith(roots[side]+'/'))throw new Error('unsafe path');res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 for(const engine of ['chromium','firefox']){
  browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:'/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox'}:{})});
  for(let pair=1;pair<=5;pair++)for(const side of ['baseline','current']){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(String(e)));const requests=[];page.on('request',req=>requests.push({url:req.url(),time:Date.now()}));
   await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin===origin)return route.continue();if(url.startsWith('https://cdn.jest.com/'))return route.fulfill({status:200,contentType:'application/javascript',body:''});external.push(url);return route.abort();});
   await page.addInitScript(()=>{
    window.__RIDDLE_QUEST_BROWSER_TEST__=true;window.latency={events:[],unhandled:[],longTasks:[],longTaskSupported:PerformanceObserver.supportedEntryTypes.includes('longtask')};
    window.addEventListener('unhandledrejection',e=>window.latency.unhandled.push(String(e.reason)));
    if(window.latency.longTaskSupported)new PerformanceObserver(list=>window.latency.longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration})))).observe({type:'longtask',buffered:true});
    localStorage.setItem('appLanguage','en');localStorage.setItem('riddleQuest:soundEnabled','false');localStorage.setItem('riddleQuest:reducedMotion','true');localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest','seen');localStorage.setItem('riddleQuest:tooltipSequenceSeen:profileTour:v3:jest-guest','seen');sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest','seen');
    for(const name of ['submitAnswer','gameCoins','gameHint','gameSkip','hintAfterWrongGuess','achievementEarned','classicFromDaily'])localStorage.setItem('riddleQuest:tooltipSeen:'+name+':jest-guest','seen');
    const dispatch=window.dispatchEvent.bind(window);window.dispatchEvent=event=>{
     if(event.type==='riddle-quest:host-to-game'||event.type==='riddle-quest:game-to-host'){
      const message=event.detail;window.latency.events.push({at:performance.now(),type:message?.type,operation:message?.payload?.operation,requestId:message?.requestId,riddleId:message?.payload?.riddle?.riddleId});
      if(window.holdGuess&&event.type==='riddle-quest:host-to-game'&&message?.payload?.operation==='guess'){window.heldGuess=event;return true;}
     }return dispatch(event);
    };window.releaseGuess=()=>{window.holdGuess=false;dispatch(window.heldGuess);};
   });
   await page.goto(origin+'/'+side+'/?harness=jest&dailyCompleted=1');await page.waitForFunction(()=>window.latency.events.some(x=>x.type==='host:riddleLoaded'));
   const play=page.getByRole('button',{name:/let's play/i});await play.waitFor();await play.evaluate(card=>Promise.all(card.closest('.onboarding-card').getAnimations({subtree:true}).map(x=>x.finished.catch(()=>undefined))));await play.click();await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();await page.locator('.onboarding-card').waitFor({state:'hidden'});
   await page.locator('.keyboard').waitFor();
   for(const letter of 'CRANE')await page.locator('.keyboard').getByRole('button',{name:new RegExp('^'+letter+'$')}).click();
   await page.evaluate(()=>{window.holdGuess=true;});
   const feedbackMs=await page.locator('.submit-action').evaluate(async button=>{const started=performance.now();button.click();while(document.querySelectorAll('.guess-row:first-child .cell.red').length!==3){if(performance.now()-started>1000)throw new Error('Feedback waited for authority');await new Promise(resolve=>requestAnimationFrame(resolve));}return performance.now()-started;});
   const tooltip=page.locator('[data-tooltip-id=hintAfterWrongGuess] button');if(await tooltip.count())await tooltip.click();await page.locator('.keyboard').getByRole('button',{name:/^P$/}).click();await page.waitForFunction(()=>Boolean(window.heldGuess));
   await page.evaluate(async()=>{window.releaseGuess();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   assert.equal(await page.locator('.guess-row').nth(1).locator('.cell').first().textContent(),'P');assert.equal(await page.locator('.guess-row:first-child .cell.green').count(),2);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   const trace=await page.evaluate(()=>({ ...window.latency,resources:performance.getEntriesByType('resource').map(x=>({name:x.name,start:x.startTime,duration:x.duration,bytes:x.transferSize})),onboardingExcludedFromFeedback:true}));assert.deepEqual(trace.unhandled,[]);
   const firstRiddleMs=trace.events.find(x=>x.type==='host:riddleLoaded').at;const ready=trace.events.find(x=>x.type==='game:ready');assert.ok(ready);assert.ok(firstRiddleMs>=ready.at);assert.ok(trace.events.some(x=>x.operation==='guess'));
   const row={engine,browserVersion:browser.version(),pair,side,firstRiddleMs,readyToRiddleMs:firstRiddleMs-ready.at,feedbackMs,errors,external,requests,trace};results.push(row);await writeFile(path.join(evidence,'measurements.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({engine,pair,side,firstRiddleMs,readyToRiddleMs:row.readyToRiddleMs,feedbackMs}));await context.close();
  }await browser.close();browser=undefined;
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
