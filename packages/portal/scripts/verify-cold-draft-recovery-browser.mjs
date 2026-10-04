import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.COLD_DRAFT_REACT_MODE??'development';
const output=path.resolve(process.env.COLD_DRAFT_REPORT_DIR??path.join(root,'../../artifacts/cold-draft-recovery-2026-10-03',mode));
const baseline=process.env.COLD_DRAFT_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/cold-draft-'));let server,browser;
const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {writePendingGuessJournal,pendingPlayScope} from ${JSON.stringify(path.join(root,'src/play/pendingGuessJournal.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});localStorage.setItem('appLanguage','en');
const variant=new URL(location.href).searchParams.get('variant')??'classicReplaced',uid='jest-guest',scope=pendingPlayScope(uid,1,'en');
const daily=variant.startsWith('daily')||variant==='foreignMode'||variant==='completedDailyFallback',pending=variant==='queued'||variant==='paid',replaced=variant.endsWith('Replaced')||pending;
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),before=await source.loadProfile(uid);
await source.submitGuess({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess:'piano',requestId:'advance-before-mount'});
await source.completeGame({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken});
const currentProfile=await source.loadProfile(uid),classic=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2}),challenge=await source.loadRiddle({gameMode:'challenge',locale:'en'});
const old=daily&&variant!=='foreignMode'?challenge:classic,host=daily?challenge:classic;
const issued={...host,...(replaced?{sessionToken:'00000000-0000-4000-8000-000000000099'}:{}),...(variant==='classicRenamed'?{riddleId:'classic-reissued-2'}:{})};
function base(riddle){const s=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle});return {currentLetters:s.currentLetters,activeSlotIndex:s.activeSlotIndex,guesses:s.guesses,engineSnapshot:s.engineSnapshot,modal:s.modal,lastOutcome:s.lastOutcome,completionAcknowledged:s.completionAcknowledged,letterStates:s.letterStates,profile:before,lastRewards:s.lastRewards,optimisticAchievementIds:s.optimisticAchievementIds};}
const draft=old.gameMode==='challenge'?['E','','','']:['C','L','','',''],slot=old.gameMode==='challenge'?1:2;
const guess={message:{type:'game:submitGuess',requestId:'cold-held-guess',payload:{riddleId:old.riddleId,gameMode:old.gameMode,sessionToken:old.sessionToken,guess:'zzzzz',requestId:'cold-held-guess'}},attempts:1,isCorrect:false,gameOver:false,canContinue:false,feedback:Array(5).fill('red')};
const journal={version:1,scope,riddle:variant==='successor'?first:old,confirmedClassicIndex:2,base:base(variant==='successor'?first:old),draft:variant==='successor'?Array(5).fill(''):draft,draftActiveSlotIndex:variant==='successor'?0:slot,successors:variant==='successor'?[{riddle:classic,base:base(classic),draft, draftActiveSlotIndex:slot}]:[],queue:variant==='queued'?[guess]:[],...(variant==='paid'?{coinAction:{type:'game:requestHint',requestId:'cold-held-hint',payload:{riddleId:old.riddleId,gameMode:old.gameMode,sessionToken:old.sessionToken,requestId:'cold-held-hint',currentAttempt:draft}}}:{})};
if(!sessionStorage.getItem('coldDraftSeeded')){writePendingGuessJournal(journal);sessionStorage.setItem('coldDraftSeeded','yes');}
window.readJournal=()=>JSON.parse(localStorage.getItem('riddleQuest:pendingPlay:v1:'+scope)??'null');
window.probe={variant,old,issued,currentProfile,guesses:[],hints:[],spends:[],completions:[],inbound:[],outbound:[],errors:[],unhandled:[]};
const deliveryTimers=new Set(),setIntervalBefore=window.setInterval.bind(window),clearIntervalBefore=window.clearInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{const id=setIntervalBefore(callback,delay,...args);if(delay===5000)deliveryTimers.add(id);return id;};
window.clearInterval=id=>{deliveryTimers.delete(id);return clearIntervalBefore(id);};window.deliveryTimerCount=()=>deliveryTimers.size;
window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.completeDailyElsewhere=async()=>{await source.submitGuess({riddleId:challenge.riddleId,gameMode:'challenge',sessionToken:challenge.sessionToken,guess:'echo',requestId:'completed-daily-elsewhere'});await source.completeGame({riddleId:challenge.riddleId,gameMode:'challenge',sessionToken:challenge.sessionToken});window.dispatchEvent(new CustomEvent('riddle-quest:game-to-host',{detail:{type:'game:loadRiddle',requestId:'reload-completed-daily',payload:{gameMode:'challenge',locale:'en'}}}));};
const services={...source,loadRiddle:async input=>variant==='completedDailyFallback'?source.loadRiddle(input):issued,
 submitGuess:async input=>{window.probe.guesses.push(input);if(input.requestId==='cold-held-guess')await new Promise(resolve=>window.releaseGuess=resolve);return source.submitGuess(variant==='completedDailyFallback'?input:{...input,riddleId:host.riddleId});},
 requestHint:async input=>{window.probe.hints.push(input);await new Promise(resolve=>window.releaseHint=resolve);return source.requestHint(input);},
 spendCoins:async input=>{window.probe.spends.push(input);return source.spendCoins(input);},completeGame:async input=>{window.probe.completions.push(input);return source.completeGame(input);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:variant==='paid',raceAvailable:false,initialGameMode:daily?'challenge':'classic',initialPlayerData:{schemaVersion:1,updatedAt:10,profile:currentProfile,activeGame:null}});
createRoot(document.querySelector('#root')).render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'cold-draft-original-recovery',async load(id){if(baseline&&id.endsWith('/useProvisionalPlayRecovery.ts'))return readFile(path.join(baseline,'useProvisionalPlayRecovery.before.txt'),'utf8');if(baseline&&id.endsWith('/pendingGuessJournal.ts'))return readFile(path.join(baseline,'pendingGuessJournal.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.COLD_DRAFT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.COLD_DRAFT_QUICK==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const variant of quick?[process.env.COLD_DRAFT_VARIANT??'classicReplaced']:['classicReplaced','classicRenamed','dailyReplaced','classicSame','dailySame','foreignMode','queued','paid','successor','completedDailyFallback']){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(4000);
   const metric=(name,actual,expected)=>{observations.push({width,height,variant,name,actual,expected});assert.deepEqual(actual,expected,name);};
   const row=async index=>(await page.locator('.guess-row').nth(index).locator('.cell').allTextContents()).join('').toUpperCase();
   await page.goto(url+'/?variant='+variant);await page.locator('.guess-board').waitFor();await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'));await page.waitForTimeout(80);
   const superseded=variant.endsWith('Replaced')||variant==='classicRenamed',pending=variant==='queued'||variant==='paid',foreign=variant==='foreignMode',daily=variant.startsWith('daily')||foreign||variant==='completedDailyFallback';
   metric('host balance survives the old checkpoint',Number((await page.locator('[data-coin-meter] strong').textContent()).replaceAll(',','')),await page.evaluate(()=>window.probe.currentProfile.coins));
   if(superseded)metric('superseded draft journal is retired on cold startup',await page.evaluate(()=>window.readJournal()),null);
   else metric('valid or required journal survives cold startup',await page.evaluate(()=>!!window.readJournal()),true);
   metric('only matching unsubmitted input is restored',await row(variant==='queued'?1:0),superseded||foreign?'':daily?'E':'CL');
   metric('no unexpected paid spend',await page.evaluate(()=>window.probe.spends),[]);metric('recovery creates no completion',await page.evaluate(()=>window.probe.completions),[]);
   metric('only required held guess is delivered',await page.evaluate(()=>window.probe.guesses.map(x=>({id:x.requestId,session:x.sessionToken}))),variant==='queued'?[{id:'cold-held-guess',session:await page.evaluate(()=>window.probe.old.sessionToken)}]:[]);
   metric('only required held hint is delivered',await page.evaluate(()=>window.probe.hints.map(x=>({id:x.requestId,session:x.sessionToken}))),variant==='paid'?[{id:'cold-held-hint',session:await page.evaluate(()=>window.probe.old.sessionToken)}]:[]);
   metric('only required deliveries own a retry interval',await page.evaluate(()=>window.deliveryTimerCount()),pending?1:0);
   if(variant==='completedDailyFallback'){
    await page.evaluate(()=>window.completeDailyElsewhere());await page.getByRole('heading',{name:/What has a face/i}).waitFor();
    metric('mode handoff does not transfer the previous draft',await row(0),'');
    metric('mode handoff keeps the previous durable input until a new submission',await page.evaluate(()=>window.readJournal()?.draft),['E','','','']);
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('qqqqq');await page.locator('.submit-action').click();await page.waitForTimeout(80);
    metric('new mode submission is delivered',await page.evaluate(()=>window.probe.guesses.length),1);
    metric('previous in-memory draft does not block the new mode submission',await page.evaluate(()=>({mode:window.probe.guesses[0].gameMode,session:window.probe.guesses[0].sessionToken})),{mode:'classic',session:'00000000-0000-4000-8000-000000000002'});
    await page.waitForFunction(()=>window.readJournal()===null);
    metric('Classic fallback confirms exactly one new wrong row',await row(0),'QQQQQ');
   }else if(!pending){
    if(!superseded&&!foreign)metric('matching draft selection is restored',await page.locator('.guess-row').first().locator('.cell').nth(daily?1:2).getAttribute('aria-current'),'true');
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type(daily?'a':'o');
    metric('native typing continues only the displayed session',await row(0),superseded||foreign?(daily?'A':'O'):daily?'EA':'CLO');
    if(superseded){
     for(let n=1;n<(daily?4:5);n++)await page.keyboard.type('q');await page.locator('.submit-action').click();await page.waitForFunction(()=>window.probe.guesses.length===1);
     metric('new submission belongs to the host-issued session',await page.evaluate(()=>({session:window.probe.guesses[0].sessionToken,riddleId:window.probe.guesses[0].riddleId})),await page.evaluate(()=>({session:window.probe.issued.sessionToken,riddleId:window.probe.issued.riddleId})));
    }else if(!foreign){
     await page.reload();await page.locator('.guess-board').waitFor();await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'));await page.waitForTimeout(80);
     metric('same-session edited draft survives a true reload',await row(0),daily?'EA':'CLO');
    }else metric('other-mode journal input remains untouched',await page.evaluate(()=>window.readJournal()?.draft),['C','L','','','']);
   }
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,width+'-'+height+'-'+variant+'.png')});await context.close();
  }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe,journal:window.readJournal()})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
