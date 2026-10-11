import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../../node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '../../node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';

const root=path.resolve('packages/portal');
const mode=process.env.PENDING_LIFE_MODE??'development',engine=process.env.PENDING_LIFE_BROWSER??'chromium';
const baseline=process.env.AUTHORITY_TERMINAL_BASELINE_DIR;
const recoveryBaseline=process.env.AUTHORITY_TERMINAL_RECOVERY_BASELINE_DIR;
const output=path.resolve(process.env.PENDING_LIFE_REPORT_DIR??path.join(root,'../../artifacts/solo-terminal-paid-liveness-fix-2026-10-09/full-app-'+engine+'-'+mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/authority-terminal-'));let browser,server;
const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {createRedditGuestHostServices} from ${JSON.stringify(path.join(root,'src/reddit/RedditGuestHostServices.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {createSavedGame} from ${JSON.stringify(path.join(root,'src/play/GameSessionCheckpoints.ts'))};
import {writePendingGuessJournal,pendingPlayScope} from ${JSON.stringify(path.join(root,'src/play/pendingGuessJournal.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});localStorage.setItem('appLanguage','en');
const params=new URL(location.href).searchParams,attempts=Number(params.get('attempts')??1),provider=params.get('provider')??'missing',negative=params.has('negative'),prepare=params.has('prepare');
const source=attempts===6?createFakeHostServices():createRedditGuestHostServices();
const uid=attempts===6?'jest-guest':'reddit-guest';
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');
window.probe={outbound:[],inbound:[],errors:[],unhandled:[],saves:[],completions:[],spends:[],seedSpends:0};
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));
window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const first=await source.loadRiddle({gameMode:'classic',locale:'en'});
const oldState=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:first});
const oldCheckpoint=createSavedGame(gameSessionReducer(oldState,{type:'typeLetter',letter:'X'}),10);
const accepted=[];let seedReceipt;window.releasePaid=()=>{window.holdPaid=false;for(const resolve of window.paidResolvers)resolve();};window.holdPaid=true;window.paidResolvers=[];
if(!negative&&!prepare)for(let attempt=1;attempt<=attempts;attempt++){
 if(attempt===6){seedReceipt=await source.spendCoins({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,reason:'continue',requestId:'seed-continue'});window.probe.seedSpends++;}
 const guess=attempt===attempts?'piano':['qqqqq','rrrrr','sssss','ttttt','uuuuu'][attempt-1];
 const result=await source.submitGuess({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess,requestId:'accepted-'+attempt});
 accepted.push({attempt,feedback:result.feedback});
}
let activeGame=prepare||provider==='missing'?null:structuredClone(oldCheckpoint);
if(activeGame&&provider==='foreign')activeGame.sessionToken='00000000-0000-4000-8000-000000000099';
if(activeGame&&provider==='forged'){
 activeGame.guesses=[{guess:[...'QQQQQ'],feedback:Array(5).fill('green')}];
 activeGame.engineSnapshot={guesses:activeGame.guesses,attemptsUsed:1,hasUsedContinue:false,gameOver:true};
 activeGame.pendingOutcome={id:'forged-provider-win',kind:'win',isCorrect:true,attempts:1,riddleId:first.riddleId,sessionToken:first.sessionToken,gameMode:'classic'};
}
window.probe.before=await source.loadProfile(uid);window.holdCompletion=true;let completion;
if(params.has('journal')&&!params.has('native')&&!negative&&!prepare){
 const scope=pendingPlayScope(uid,1,'en');
 const base={currentLetters:oldState.currentLetters,activeSlotIndex:oldState.activeSlotIndex,guesses:oldState.guesses,
 engineSnapshot:oldState.engineSnapshot,modal:oldState.modal,lastOutcome:oldState.lastOutcome,
 completionAcknowledged:oldState.completionAcknowledged,letterStates:oldState.letterStates,profile:window.probe.before,
 lastRewards:oldState.lastRewards,optimisticAchievementIds:oldState.optimisticAchievementIds};
 writePendingGuessJournal({version:1,scope,riddle:first,confirmedClassicIndex:1,base,successors:[],draft:Array(5).fill(''),
 queue:accepted.map(row=>({message:{type:'game:submitGuess',requestId:'accepted-'+row.attempt,
 payload:{riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess:row.feedback.map(c=>c.letter).join(''),requestId:'accepted-'+row.attempt}},
 attempts:row.attempt,isCorrect:row.attempt===attempts,gameOver:row.attempt===attempts,
 canContinue:row.attempt===5&&attempts===6,feedback:row.feedback.map(c=>c.status)})),coinAction:{type:'game:spendCoins',requestId:'seed-continue',payload:{reason:'continue',gameMode:'classic',riddleId:first.riddleId,sessionToken:first.sessionToken}}});
}
const services={...source,
 submitGuess:async input=>{
  const result=await source.submitGuess(input);
  if(prepare){
   const calls=JSON.parse(localStorage.getItem('terminalJournalNativeGuesses')??'[]');calls.push({input,result});
   localStorage.setItem('terminalJournalNativeGuesses',JSON.stringify(calls));
   if(result.isCorrect)await new Promise(()=>{});
  }
  return result;
 },
 loadRiddle:async input=>{const riddle=await source.loadRiddle(input);return riddle.sessionToken===first.sessionToken&&!negative?{...riddle,acceptedGuesses:accepted}:riddle;},
 spendCoins:async input=>{window.probe.spends.push(input);if(window.holdPaid)await new Promise(resolve=>window.paidResolvers.push(resolve));return seedReceipt;},
 completeGame:input=>{
  window.probe.completions.push(input);
  // The paid-attempt fixture reuses the existing fake authority with its explicit idempotent receipt contract.
  // Guest fixtures retain their actual service's once-per-round completion behavior.
  if(!completion)completion=(async()=>{if(window.holdCompletion)await new Promise(resolve=>window.releaseCompletion=()=>{window.holdCompletion=false;resolve();});return source.completeGame(input);})();
  return completion;
 },
};
const session=createHostedPlaySession({hostServices:services,economyAvailable:attempts===6,raceAvailable:false,
 initialPlayerData:{schemaVersion:1,updatedAt:10,profile:window.probe.before,activeGame},
 onPlayerDataChange:update=>{window.probe.saves.push(update);}});
createRoot(document.querySelector('#root')).render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);
window.profile=()=>source.loadProfile(uid);window.probe.ready=true;
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-authority-terminal',async load(id){if(baseline&&id.endsWith('/gameSession.ts'))return readFile(path.join(baseline,'gameSession.before.txt'),'utf8');if(recoveryBaseline&&id.endsWith('/useProvisionalPlayRecovery.ts'))return readFile(path.join(recoveryBaseline,'useProvisionalPlayRecovery.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 browser=await(engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:process.env.PENDING_LIFE_FIREFOX_EXECUTABLE}:{})});
 for(const [width,height] of [[390,844],[1280,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({engine,mode,width,height,name,actual,expected});assert.deepEqual(actual,expected,name);};
  await page.goto(url+'?attempts=6&provider=missing&journal=1');await page.locator('.modal-victory').waitFor();await page.waitForFunction(()=>window.probe.spends.length>0&&typeof window.releaseCompletion==='function');
  metric('terminal recovery never resubmits accepted guesses',await page.evaluate(()=>window.probe.outbound.filter(x=>x.type==='game:submitGuess').length),0);
  metric('payment uses original seeded receipt',await page.evaluate(()=>window.probe.spends.every(x=>x.requestId==='seed-continue')),true);
  metric('unsettled payment remains durable',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).map(k=>JSON.parse(localStorage.getItem(k)).coinAction?.requestId)),['seed-continue']);
  await page.evaluate(()=>window.releaseCompletion());await page.waitForFunction(()=>window.probe.saves.some(x=>Object.hasOwn(x,'activeGame')&&x.activeGame===null));
  metric('unsettled paid operation makes the application inert',await page.locator('.modal-victory').evaluate(el=>Boolean(el.closest('[inert]'))),true);
  metric('unresolved payment keeps victory open after completion acknowledgement',await page.locator('.modal-victory').count(),1);
  metric('paid receipt remains exact after completion',await page.evaluate(()=>window.probe.outbound.filter(x=>x.type==='game:spendCoins').every(x=>x.requestId==='seed-continue'&&x.payload.sessionToken===window.probe.inbound.find(x=>x.type==='host:riddleLoaded').payload.riddle.sessionToken)),true);
  await page.screenshot({path:path.join(output,width+'-held-payment.png')});await page.evaluate(()=>window.releasePaid());
  await page.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).every(k=>!JSON.parse(localStorage.getItem(k)).coinAction));
  for(let step=0;step<10&&await page.locator('.modal-victory').count();step++){
   const chest=page.locator('.coin-award[data-coin-collection="pending"] .reward-chest');if(await chest.count()){await chest.click();await page.locator('.coin-award[data-coin-collection="complete"]').waitFor();}
   const next=page.locator('.modal-victory button').filter({hasText:/Next/i}).last();await next.click();await page.waitForTimeout(100);
  }
  await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.index===2));
  metric('paid settlement releases victory Next',await page.locator('.modal-victory').count(),0);
  metric('Next opens a fresh empty round',await page.locator('.guess-row .cell').allTextContents(),Array(25).fill(''));
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('q');metric('next round accepts typing',await page.locator('.guess-row').first().innerText(),'Q');
  metric('underlying seeded Continue charged once',await page.evaluate(()=>window.probe.seedSpends),1);
  metric('no application errors',await page.evaluate(()=>[...window.probe.errors,...window.probe.unhandled]),[]);
  await page.screenshot({path:path.join(output,width+'-next-playable.png')});await context.close();
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
