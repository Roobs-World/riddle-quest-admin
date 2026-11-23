import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.AUTHORITY_LOSS_REACT_MODE??'development';
const baseline=process.env.AUTHORITY_LOSS_BASELINE_DIR;
const output=path.resolve(process.env.AUTHORITY_LOSS_REPORT_DIR??path.join(root,'../../builds/test-evidence/authority-loss-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/authority-loss-'));let browser,server;
const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {createRedditGuestHostServices} from ${JSON.stringify(path.join(root,'../../platforms/web/reddit/src/RedditGuestHostServices.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'../hosted/src/play/gameSession.ts'))};
import {createSavedGame} from ${JSON.stringify(path.join(root,'../hosted/src/play/GameSessionCheckpoints.ts'))};
import {writePendingGuessJournal,pendingPlayScope} from ${JSON.stringify(path.join(root,'../hosted/src/play/pendingGuessJournal.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});localStorage.setItem('appLanguage','en');
const params=new URL(location.href).searchParams,attempts=6,provider=params.get('provider')??'missing',negative=params.has('negative'),prepare=params.has('prepare');
const rawSource=attempts===6?createFakeHostServices():createRedditGuestHostServices();
const paidReceipts=new Map();
const source={...rawSource,spendCoins:input=>{
 if(!input.requestId)throw Error('Paid fixture requires an explicit request identity');
 const fingerprint=JSON.stringify([input.riddleId,input.gameMode,input.sessionToken,input.reason,input.amount??50]);
 const prior=paidReceipts.get(input.requestId);
 if(prior){if(prior.fingerprint!==fingerprint)throw Error('Paid request identity was reused with different input');return prior.receipt;}
 window.probe.paidDebits++;
 const receipt=rawSource.spendCoins(input);
 paidReceipts.set(input.requestId,{fingerprint,receipt});
 return receipt;
}};
const uid=attempts===6?'jest-guest':'reddit-guest';
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');
window.probe={outbound:[],inbound:[],errors:[],unhandled:[],saves:[],completions:[],spends:[],seedSpends:0,paidDebits:0};
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));
window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const first=await source.loadRiddle({gameMode:'classic',locale:'en'});
const oldState=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:first});
const oldCheckpoint=createSavedGame(gameSessionReducer(oldState,{type:'typeLetter',letter:'X'}),10);
const accepted=[];
if(!negative&&!prepare)for(let attempt=1;attempt<=attempts;attempt++){
 if(attempt===6){await source.spendCoins({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,reason:'continue',requestId:'seed-continue'});window.probe.seedSpends++;}
 const guess=['qqqqq','rrrrr','sssss','ttttt','uuuuu','vvvvv'][attempt-1];
 const result=await source.submitGuess({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess,requestId:'accepted-'+attempt});
 accepted.push({attempt,feedback:result.feedback});
}
let activeGame=prepare||provider==='missing'?null:structuredClone(oldCheckpoint);
if(activeGame&&provider==='foreign')activeGame.sessionToken='00000000-0000-4000-8000-000000000077';
if(activeGame&&provider==='forged'){
 activeGame.guesses=[{guess:[...'QQQQQ'],feedback:Array(5).fill('green')}];
 activeGame.engineSnapshot={guesses:activeGame.guesses,attemptsUsed:1,hasUsedContinue:false,gameOver:true};
 activeGame.pendingOutcome={id:'forged-provider-win',kind:'win',isCorrect:true,attempts:1,riddleId:first.riddleId,sessionToken:first.sessionToken,gameMode:'classic'};
}
window.probe.before=await source.loadProfile(uid);window.holdCompletion=true;let completion,completed=false;const retrySource=createFakeHostServices();
if(params.has('journal')&&!params.has('native')&&!negative&&!prepare){
 const scope=pendingPlayScope(uid,1,'en');
 const base={currentLetters:oldState.currentLetters,activeSlotIndex:oldState.activeSlotIndex,guesses:oldState.guesses,
 engineSnapshot:oldState.engineSnapshot,modal:oldState.modal,lastOutcome:oldState.lastOutcome,
 completionAcknowledged:oldState.completionAcknowledged,letterStates:oldState.letterStates,profile:window.probe.before,
 lastRewards:oldState.lastRewards,optimisticAchievementIds:oldState.optimisticAchievementIds};
 writePendingGuessJournal({version:1,scope,riddle:first,confirmedClassicIndex:1,base,successors:[],draft:Array(5).fill(''),
 ...(params.has('paid')?{coinAction:{type:'game:spendCoins',requestId:'seed-continue',payload:{riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,reason:'continue'}}}:{}),
 queue:accepted.map(row=>({message:{type:'game:submitGuess',requestId:'accepted-'+row.attempt,
 payload:{riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess:row.feedback.map(c=>c.letter).join(''),requestId:'accepted-'+row.attempt}},
 attempts:row.attempt,isCorrect:false,gameOver:row.attempt===attempts,
 canContinue:row.attempt===5&&attempts===6,feedback:row.feedback.map(c=>c.status)}))});
}
const services={...source,
 submitGuess:async input=>{
  const result=await (completed?retrySource:source).submitGuess(input);
  if(prepare){
   const calls=JSON.parse(localStorage.getItem('lossJournalNativeGuesses')??'[]');calls.push({input,result});
   localStorage.setItem('lossJournalNativeGuesses',JSON.stringify(calls));
   if(result.gameOver)await new Promise(()=>{});
  }
  return result;
 },
 loadRiddle:async input=>{if(completed){const retry=await retrySource.loadRiddle(input);return {...retry,sessionToken:'00000000-0000-4000-8000-000000000099'};}const riddle=await source.loadRiddle(input);return riddle.sessionToken===first.sessionToken&&!negative?{...riddle,acceptedGuesses:accepted}:riddle;},
 spendCoins:async input=>{window.probe.spends.push(input);
 if(params.has('paid'))await new Promise(resolve=>window.releasePaidReceipt=resolve);
 return source.spendCoins(input);},
 completeGame:input=>{
  window.probe.completions.push(input);
  // The fixture wraps the fake authority with an explicit request-keyed paid receipt contract.
  // Guest fixtures retain their actual service's once-per-round completion behavior.
  if(!completion)completion=(async()=>{if(window.holdCompletion)await new Promise(resolve=>window.releaseCompletion=()=>{window.holdCompletion=false;resolve();});const receipt=await source.completeGame(input);completed=true;return receipt;})();
  return completion;
 },
};
const session=createHostedPlaySession({hostServices:services,economyAvailable:attempts===6,raceAvailable:false,
 initialPlayerData:{schemaVersion:1,updatedAt:10,profile:window.probe.before,activeGame},
 onPlayerDataChange:update=>{window.probe.saves.push(update);}});
createRoot(document.querySelector('#root')).render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);
window.profile=()=>source.loadProfile(uid);window.probe.ready=true;
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-authority-loss',async load(id){if(baseline){const names=['gameSession','ConfirmedRiddleOutcome','pendingGuessJournal','useProvisionalPlayRecovery'];const name=names.find(name=>id.endsWith('/'+name+'.ts'));if(name)return readFile(path.join(baseline,name+'.before.txt'),'utf8');}}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.AUTHORITY_LOSS_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});
  const quick=process.env.AUTHORITY_LOSS_QUICK==='1';
  const native=process.env.AUTHORITY_LOSS_NATIVE!=='0';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const provider of quick?['missing']:['missing','stale','foreign','forged'])for(const journal of quick?['none']:['none','queued','paid']){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,provider,journal,name,actual,expected});assert.deepEqual(actual,expected,name);};
   const query='?provider='+provider+(journal!=='none'?'&journal=1':'')+(journal==='paid'?'&paid=1':'');
   if(native&&journal==='queued'){
    await page.goto(url+query+'&native=1&prepare=1');await page.locator('.guess-board').waitFor();
    for(let attempt=1;attempt<=6;attempt++){
     if(attempt===6){await page.locator('.modal-continue').waitFor();await page.getByRole('button',{name:/Coins to Try Again/i}).click();await page.locator('.modal-continue').waitFor({state:'hidden'});}
     await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type(['qqqqq','rrrrr','sssss','ttttt','uuuuu','vvvvv'][attempt-1]);await page.locator('.submit-action').click();
     await page.waitForFunction(count=>JSON.parse(localStorage.getItem('lossJournalNativeGuesses')??'[]').length===count,attempt);
    }
    const pending=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).map(k=>JSON.parse(localStorage.getItem(k))));
    await writeFile(path.join(output,`${width}-${height}-${provider}-native-journal.json`),JSON.stringify(pending,null,2));
    metric('native lost sixth reply leaves its exact terminal request',pending[0]?.queue.at(-1)?.attempts,6);
    metric('native lost sixth reply is a loss',pending[0]?.queue.at(-1)?.isCorrect,false);
   }
   await page.goto(url+query+(native&&journal==='queued'?'&native=1':''));await page.locator('.guess-board').waitFor();
   await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'));
   await page.waitForTimeout(150);
   metric('exhausted round blocks Submit while completion is pending',await page.locator('.submit-action').isDisabled(),true);
   metric('exhausted round has no editable board cells',await page.locator('.guess-row button:not([disabled])').count(),0);
   metric('loss does not open victory',await page.locator('.modal-victory').count(),0);
   metric('paid exhausted round cannot buy another Continue',await page.locator('.modal-continue').count(),0);
   await page.keyboard.type('piano');
   metric('native typing cannot reopen exhausted round',await page.locator('.guess-row').nth(1).innerText(),'');
   metric('sixth accepted row retains host feedback',(await page.locator('.guess-row').first().locator('.cell').allTextContents()).join('').toUpperCase(),'VVVVV');
   metric('recovery does not submit a seventh guess',await page.evaluate(()=>window.probe.outbound.filter(x=>x.type==='game:submitGuess').length),0);
   metric('recovery does not charge Continue again',await page.evaluate(()=>window.probe.paidDebits-window.probe.seedSpends),0);
   if(journal==='paid'){
    await page.waitForFunction(()=>typeof window.releasePaidReceipt==='function');
    metric('paid recovery replays only the original request',await page.evaluate(()=>window.probe.spends.map(x=>[x.requestId,x.riddleId,x.sessionToken,x.gameMode,x.reason])),[await page.evaluate(()=>{const r=window.probe.inbound.find(x=>x.type==='host:riddleLoaded').payload.riddle;return ['seed-continue',r.riddleId,r.sessionToken,r.gameMode,'continue'];})]);
    metric('terminal proof retains the unresolved original paid receipt',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).map(k=>{const j=JSON.parse(localStorage.getItem(k));return {queue:j.queue.length,successors:j.successors.length,requestId:j.coinAction?.requestId};})),[{queue:0,successors:0,requestId:'seed-continue'}]);
    await page.evaluate(()=>window.releasePaidReceipt());
    await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:operationResult'&&x.requestId==='seed-continue'&&x.payload.operation==='spendCoins'&&x.payload.ok));
    await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('riddleQuest:pendingPlay:v1:')));
    metric('paid receipt replay preserves the original debit count',await page.evaluate(()=>window.probe.paidDebits),1);
   }else metric('recovery does not replay a paid request without a journal',await page.evaluate(()=>window.probe.spends),[]);
   if(journal!=='none')metric('owned terminal journal retires before completion',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).length),0);
   await page.waitForFunction(()=>typeof window.releaseCompletion==='function');
   await page.waitForFunction(()=>window.probe.saves.some(x=>x.activeGame?.pendingOutcome?.kind==='loss'));
   metric('pending loss is checkpointed using accepted attempts',await page.evaluate(()=>window.probe.saves.findLast(x=>x.activeGame)?.activeGame.pendingOutcome.attempts),6);
   metric('authority waits for completion before counting loss',await page.evaluate(async()=>{const p=await window.profile(),b=window.probe.before;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins,p.coins];}),[0,0,250]);
   await page.screenshot({path:path.join(output,`${width}-${height}-${provider}-${journal}-pending.png`)});
   await page.evaluate(()=>window.releaseCompletion());
   await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.sessionToken.endsWith('99')));
   metric('completion counts one loss without advancing Classic or rewarding coins',await page.evaluate(async()=>{const p=await window.profile(),b=window.probe.before;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins,p.classicIndex,p.coins];}),[1,0,1,250]);
   metric('completion preserves original issued round identity',await page.evaluate(()=>[...new Set(window.probe.completions.map(x=>JSON.stringify([x.riddleId,x.sessionToken])))].map(x=>JSON.parse(x))),[await page.evaluate(()=>{const r=window.probe.inbound.find(x=>x.type==='host:riddleLoaded').payload.riddle;return[r.riddleId,r.sessionToken];})]);
   metric('completion retries retain one durable identity',await page.evaluate(()=>new Set(window.probe.outbound.filter(x=>x.type==='game:completeGame').map(x=>x.requestId)).size),1);
   metric('confirmed retry has empty cells',await page.locator('.guess-row .cell').allTextContents(),Array(25).fill(''));
   await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('qqqqq');await page.locator('.submit-action').click();
   await page.waitForFunction(()=>window.probe.outbound.some(x=>x.type==='game:submitGuess'));
   metric('native retry submits only to the newly issued session',await page.evaluate(()=>window.probe.outbound.filter(x=>x.type==='game:submitGuess').map(x=>x.payload.sessionToken)),['00000000-0000-4000-8000-000000000099']);
   metric('loss recovery preserves paid balance',await page.evaluate(async()=>(await window.profile()).coins),250);
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await context.close();
  }

 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
