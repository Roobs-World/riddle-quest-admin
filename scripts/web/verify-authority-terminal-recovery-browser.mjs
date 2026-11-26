import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const browserScope=process.env.PORTAL_BROWSER_SCOPE;
assert.ok(browserScope===undefined||browserScope==='jest','PORTAL_BROWSER_SCOPE must be jest or unset');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.AUTHORITY_TERMINAL_REACT_MODE??'development';
const handlerMode=process.env.AUTHORITY_TERMINAL_HANDLER_ONLY??null;assert([null,'modal','fallback'].includes(handlerMode));
const baseline=process.env.AUTHORITY_TERMINAL_BASELINE_DIR;
const recoveryBaseline=process.env.AUTHORITY_TERMINAL_RECOVERY_BASELINE_DIR;
const output=path.resolve(process.env.AUTHORITY_TERMINAL_REPORT_DIR??path.join(root,'builds/test-evidence/authority-terminal-recovery-2026-10-03',handlerMode?mode+'-'+handlerMode:mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/authority-terminal-'));let browser,server;
const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
${browserScope==='jest'?'':`import {createRedditGuestHostServices} from ${JSON.stringify(path.join(root,'platforms/web/reddit/src/RedditGuestHostServices.ts'))};`}
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,"src/gameplay/session/gameSession.ts"))};
import {createSavedGame} from ${JSON.stringify(path.join(root,"src/gameplay/session/checkpoints/GameSessionCheckpoints.ts"))};
import {writePendingGuessJournal,pendingPlayScope} from ${JSON.stringify(path.join(root,"src/gameplay/session/journal/pendingGuessJournal.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});localStorage.setItem('appLanguage','en');
const params=new URL(location.href).searchParams,attempts=Number(params.get('attempts')??1),provider=params.get('provider')??'missing',negative=params.has('negative'),prepare=params.has('prepare');
${browserScope==='jest'?`const fixtureAuthority=createFakeHostServices(),completionReceipts=new Map();
const source={...fixtureAuthority,completeGame:input=>{const key=input.gameMode+':'+input.riddleId+':'+input.sessionToken;if(!completionReceipts.has(key))completionReceipts.set(key,fixtureAuthority.completeGame(input));return completionReceipts.get(key);}};
const uid='jest-guest';`:`const source=attempts===6?createFakeHostServices():createRedditGuestHostServices();
const uid=attempts===6?'jest-guest':'reddit-guest';`}
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');
window.probe={outbound:[],inbound:[],errors:[],unhandled:[],saves:[],completions:[],spends:[],seedSpends:0,dismissed:[]};
window.addEventListener('riddle-quest:victory-dismissed',event=>window.probe.dismissed.push(event.detail));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));
window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const first=await source.loadRiddle({gameMode:'classic',locale:'en'});
const oldState=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:first});
const oldCheckpoint=createSavedGame(gameSessionReducer(oldState,{type:'typeLetter',letter:'X'}),10);
const accepted=[];
if(!negative&&!prepare)for(let attempt=1;attempt<=attempts;attempt++){
 if(attempt===6){await source.spendCoins({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,reason:'continue',requestId:'seed-continue'});window.probe.seedSpends++;}
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
window.settleAuthority=async gap=>{await source.completeGame({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken});if(gap){const round=await source.loadRiddle({gameMode:'classic',locale:'en'});if(!round.evaluation?.answer)throw new Error('fixture-authority-answer-unavailable');await source.submitGuess({riddleId:round.riddleId,gameMode:'classic',sessionToken:round.sessionToken,guess:round.evaluation.answer,requestId:'fixture-second-accepted-win'});await source.completeGame({riddleId:round.riddleId,gameMode:'classic',sessionToken:round.sessionToken});}};
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
 canContinue:row.attempt===5&&attempts===6,feedback:row.feedback.map(c=>c.status)}))});
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
 loadRiddle:async input=>{const riddle=await source.loadRiddle(input);const loaded=riddle.sessionToken===first.sessionToken&&!negative?{...riddle,acceptedGuesses:accepted}:riddle;return params.has('unknown-index')?{...loaded,index:undefined}:loaded;},
 spendCoins:async input=>{window.probe.spends.push(input);return source.spendCoins(input);},
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
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-authority-terminal',async load(id){
if(browserScope==='jest')assert.ok(!/(?:\/src\/reddit\/|\/@devvit\/)/u.test(id),'Reddit modules are outside PORTAL_BROWSER_SCOPE');
if(handlerMode==='modal'&&id.endsWith('/VictoryModalContent.tsx'))return 'export function VictoryModalContent({state,onAdvance}){return <button data-force-next data-profile-index={state.profile?.classicIndex} onClick={onAdvance}>Attempt next</button>}';
if(handlerMode==='fallback'&&id.endsWith('/GameModalView.tsx'))return 'export function GameModalView(){throw new Error("fixture-modal-unavailable")}';
if(handlerMode==='fallback'&&id.endsWith('/GameSurfaceRecovery.tsx')){const source=await readFile(id,'utf8');assert.equal(source.split('export function GameSurfaceRecovery(').length,2);return source.replace('export function GameSurfaceRecovery(','export function OriginalGameSurfaceRecovery(')+'\nexport function GameSurfaceRecovery({onNext,nextBlocked}){return <button data-force-next data-blocked={String(nextBlocked)} onClick={onNext}>Attempt next</button>}';}
if(baseline&&id.endsWith('/gameSession.ts'))return readFile(path.join(baseline,'gameSession.before.txt'),'utf8');if(recoveryBaseline&&id.endsWith('/useProvisionalPlayRecovery.ts'))return readFile(path.join(recoveryBaseline,'useProvisionalPlayRecovery.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.AUTHORITY_TERMINAL_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});
  if(handlerMode){
   for(const [width,height] of process.env.AUTHORITY_TERMINAL_QUICK==='1'?[[390,568]]:[[390,568],[1280,844]])for(const scenario of process.env.AUTHORITY_TERMINAL_QUICK==='1'?['pending']:['pending','advanced','gap','unknown-index']){
    const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
    const metric=(name,actual,expected)=>{observations.push({width,height,handlerMode,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
    await page.goto(url+'?attempts=1&provider=stale'+(scenario==='unknown-index'?'&unknown-index=1':''));
    await page.locator('[data-force-next]').waitFor();await page.waitForFunction(()=>typeof window.releaseCompletion==='function');
    if(scenario!=='pending'){
     await page.evaluate(gap=>window.settleAuthority(gap),scenario==='gap');
     await page.waitForFunction(index=>window.probe.inbound.some(message=>message.payload?.profile?.classicIndex===index),scenario==='gap'?3:2);
     if(handlerMode==='modal')await page.locator('[data-force-next][data-profile-index="'+(scenario==='gap'?3:2)+'"]').waitFor();
     else await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    const before=await page.evaluate(()=>({loads:window.probe.outbound.filter(message=>message.type==='game:loadRiddle'&&!message.payload.prepareNext).length,dismissals:window.probe.dismissed.length}));
    await page.locator('[data-force-next]').click();await page.waitForTimeout(100);
    const after=await page.evaluate(count=>({loads:window.probe.outbound.filter(message=>message.type==='game:loadRiddle'&&!message.payload.prepareNext).length,dismissals:window.probe.dismissed.length,requests:window.probe.outbound.filter(message=>message.type==='game:loadRiddle'&&!message.payload.prepareNext).slice(count).map(message=>({index:message.payload.classicIndex,hasOldSession:message.payload.sessionToken!==undefined,hasOldRiddle:message.payload.riddleId!==undefined}))}),before.loads);
    metric('handler emits a new-round request only after exact progression proof',after.loads-before.loads,['advanced','gap'].includes(scenario)?1:0);
    metric('handler dismisses victory only after exact progression proof',after.dismissals-before.dismissals,['advanced','gap'].includes(scenario)?1:0);
    metric('Next requests the current authority index without completed-round locators',after.requests,['advanced','gap'].includes(scenario)?[{index:scenario==='gap'?3:2,hasOldSession:false,hasOldRiddle:false}]:[]);
    metric('Next does not invent authority progression',await page.evaluate(async()=>{const profile=await window.profile();return[profile.gamesPlayed,profile.wins];}),await page.evaluate(delta=>[window.probe.before.gamesPlayed+delta,window.probe.before.wins+delta],scenario==='pending'?0:scenario==='gap'?2:1));
    metric('Next does not replay a guess',await page.evaluate(()=>window.probe.outbound.filter(message=>message.type==='game:submitGuess').length),0);
    metric('Next does not replay a paid action',await page.evaluate(()=>window.probe.spends),[]);
    metric('only the deliberate missing-surface error is admitted',await page.evaluate(()=>window.probe.errors.every(error=>error.includes('fixture-modal-unavailable'))),true);
    metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
    await page.evaluate(()=>window.releaseCompletion());
    await page.waitForFunction(async expected=>{const profile=await window.profile();return profile.gamesPlayed===window.probe.before.gamesPlayed+expected&&profile.wins===window.probe.before.wins+expected;},scenario==='gap'?2:1);
    metric('completion applies once including an already-committed duplicate read',await page.evaluate(async()=>{const profile=await window.profile();return[profile.gamesPlayed,profile.wins];}),await page.evaluate(delta=>[window.probe.before.gamesPlayed+delta,window.probe.before.wins+delta],scenario==='gap'?2:1));
    await page.screenshot({path:path.join(output,[handlerMode,scenario,width,height].join('-')+'.png')});await context.close();
   }
  }else{
  const journal=process.env.AUTHORITY_TERMINAL_JOURNAL_ONLY==='1';
  const quick=process.env.AUTHORITY_TERMINAL_QUICK==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const attempts of quick?[1]:[1,5,6])for(const provider of quick?['stale']:['missing','stale','foreign','forged']){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,attempts,provider,name,actual,expected});assert.deepEqual(actual,expected,name);};
   const query='?attempts='+attempts+'&provider='+provider+(journal?'&journal=1&native=1':'');
   if(journal){
    await page.goto(url+query+'&prepare=1');await page.locator('.guess-board').waitFor();
    for(let attempt=1;attempt<=attempts;attempt++){
     if(attempt===6){await page.locator('.modal-continue').waitFor();await page.getByRole('button',{name:/Coins to Try Again/i}).click();await page.locator('.modal-continue').waitFor({state:'hidden'});}
     const guess=attempt===attempts?'piano':['qqqqq','rrrrr','sssss','ttttt','uuuuu'][attempt-1];
     await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type(guess);await page.locator('.submit-action').click();
     await page.waitForFunction(count=>JSON.parse(localStorage.getItem('terminalJournalNativeGuesses')??'[]').length===count,attempt);
    }
    const pending=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).map(k=>JSON.parse(localStorage.getItem(k))));
    await writeFile(path.join(output,`${width}-${height}-${attempts}-${provider}-native-journal.json`),JSON.stringify({pending,bridge:await page.evaluate(()=>({outbound:window.probe.outbound,inbound:window.probe.inbound,errors:window.probe.errors}))},null,2));
    metric('native lost winning reply leaves a durable request',pending[0]?.queue.at(-1)?.isCorrect,true);
    metric('native host accepted the win before its receipt was withheld',await page.evaluate(()=>JSON.parse(localStorage.getItem('terminalJournalNativeGuesses')).at(-1).result.isCorrect),true);
   }
   await page.goto(url+query);await page.locator('.guess-board').waitFor();
   await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'));
   // The winning modal is lazy; allow its real module to mount before measuring the recovery result.
   try{await page.locator('.modal-victory').waitFor({timeout:3000});}catch(error){if(error.name!=='TimeoutError')throw error;}
   metric('host-accepted win opens victory without a current provider checkpoint',await page.locator('.modal-victory').count(),1);
   metric('winning cap does not reopen Continue',await page.locator('.modal-continue').count(),0);
   await page.waitForFunction(()=>typeof window.releaseCompletion==='function');
   const cells=await page.locator('.guess-row').nth(attempts===6?0:attempts-1).locator('.cell').allTextContents();
   metric('winning row comes from accepted host feedback',cells.map(x=>x.toLocaleUpperCase('en')),[...'PIANO']);
   metric('winning row retains canonical scoring',await page.locator('.guess-row').nth(attempts===6?0:attempts-1).locator('.cell').evaluateAll(cells=>cells.every(c=>c.classList.contains('green'))),true);
   metric('recovery does not submit another guess',await page.evaluate(()=>window.probe.outbound.filter(x=>x.type==='game:submitGuess').length),0);
   if(journal)metric('terminal round journal is retired before completion acknowledgement',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('riddleQuest:pendingPlay:v1:')).length),0);
   metric('recovery does not spend coins again',await page.evaluate(()=>window.probe.spends),[]);
   metric('paid sixth attempt was actually granted once before recovery',await page.evaluate(()=>window.probe.seedSpends),attempts===6?1:0);
   const next=page.locator('.modal-victory button').filter({hasText:/Next/i}).last();
   metric('Next waits for authoritative completion',await next.isDisabled(),true);
   metric('practice statistics do not advance before completion',await page.evaluate(async()=>{const p=await window.profile();return[p.gamesPlayed,p.wins];}),await page.evaluate(()=>[window.probe.before.gamesPlayed,window.probe.before.wins]));
   await page.waitForFunction(()=>window.probe.saves.some(x=>x.activeGame?.pendingOutcome?.kind==='win'));
   metric('recovered pending outcome is checkpointed',await page.evaluate(()=>window.probe.saves.findLast(x=>x.activeGame)?.activeGame.pendingOutcome.attempts),attempts);
   await page.screenshot({path:path.join(output,`${width}-${height}-${attempts}-${provider}-pending.png`)});
   await page.evaluate(()=>window.releaseCompletion());
   await page.waitForFunction(()=>window.probe.saves.some(x=>Object.hasOwn(x,'activeGame')&&x.activeGame===null));
   /* Held completions are re-sent on the 1 s/2 s retry schedule, so only distinct rounds matter here; the authority-once check covers idempotency. */metric('completion uses the original issued round',await page.evaluate(()=>[...new Map(window.probe.completions.map(x=>[x.riddleId+'\u0000'+x.sessionToken,{riddleId:x.riddleId,sessionToken:x.sessionToken}])).values()]),[await page.evaluate(()=>{const r=window.probe.inbound.find(x=>x.type==='host:riddleLoaded').payload.riddle;return{riddleId:r.riddleId,sessionToken:r.sessionToken};})]);
   metric('completion advances the authority once',await page.evaluate(async()=>{const p=await window.profile(),b=window.probe.before;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins];}),[1,1]);
   for(let step=0;step<10&&await page.locator('.modal-victory').count();step++){
    if(await page.locator('.coin-award[data-coin-collection="pending"]').count())await page.locator('.coin-award[data-coin-collection="complete"]').waitFor();
    await page.locator('.modal-victory button').filter({hasText:/Next/i}).last().click();await page.waitForTimeout(100);
   }
   await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.index===2));
   metric('native Next opens an empty new round',await page.locator('.guess-row .cell').allTextContents(),Array(25).fill(''));
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('q');
   metric('new round accepts native typing',await page.locator('.guess-row').first().innerText(),'Q');
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await context.close();
  }
  for(const [width,height] of [[390,568],[1280,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,scenario:'forged-provider-without-host-acceptance',name,actual,expected});assert.deepEqual(actual,expected,name);};
   await page.goto(url+'?negative=1&provider=forged');await page.locator('.guess-board').waitFor();await page.waitForTimeout(150);
   metric('provider colours alone cannot open victory',await page.locator('.modal-victory').count(),0);
   metric('provider colours alone cannot deliver completion',await page.evaluate(()=>window.probe.completions.length),0);
   metric('provider colours alone cannot advance authority',await page.evaluate(async()=>{const p=await window.profile();return[p.gamesPlayed,p.wins,p.coins];}),await page.evaluate(()=>{const p=window.probe.before;return[p.gamesPlayed,p.wins,p.coins];}));
   await context.close();
  }
  }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
