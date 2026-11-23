import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.BUFFERED_TERMINAL_REACT_MODE??'development';
const baseline=process.env.BUFFERED_TERMINAL_BASELINE_DIR;
const reducerBaseline=process.env.BUFFERED_TERMINAL_REDUCER_BASELINE_DIR;
const output=path.resolve(process.env.BUFFERED_TERMINAL_REPORT_DIR??path.join(root,'../../builds/test-evidence/buffered-terminal-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/buffered-terminal-'));let browser,server;
const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'../hosted/src/play/gameSession.ts'))};
import {writePendingGuessJournal,pendingPlayScope} from ${JSON.stringify(path.join(root,'../hosted/src/play/pendingGuessJournal.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});localStorage.setItem('appLanguage','en');
const params=new URL(location.href).searchParams,uid='jest-guest',scope=pendingPlayScope(uid,1,'en'),queued=!params.has('draftOnly'),rejected=params.has('rejected'),replacement=params.has('replacement'),acceptedDuringReconcile=params.has('acceptedDuringReconcile');
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');
window.probe={outbound:[],inbound:[],errors:[],unhandled:[],saves:[],guesses:[],completions:[],spends:[]};
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));
window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),next=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2});
const accepted=await source.submitGuess({riddleId:first.riddleId,gameMode:'classic',sessionToken:first.sessionToken,guess:'piano',requestId:'accepted-root-win'});
const won={...first,attemptsUsed:1,acceptedGuesses:[{attempt:1,feedback:accepted.feedback}]};
const before=await source.loadProfile(uid);window.probe.before=before;window.probe.first=first;window.probe.next=next;
function base(riddle){const state=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle});return {currentLetters:state.currentLetters,activeSlotIndex:state.activeSlotIndex,guesses:state.guesses,engineSnapshot:state.engineSnapshot,modal:state.modal,lastOutcome:state.lastOutcome,completionAcknowledged:state.completionAcknowledged,letterStates:state.letterStates,profile:before,lastRewards:state.lastRewards,optimisticAchievementIds:state.optimisticAchievementIds};}
function entry(riddle,guess,id,correct){return {message:{type:'game:submitGuess',requestId:id,payload:{riddleId:riddle.riddleId,gameMode:'classic',sessionToken:riddle.sessionToken,guess,requestId:id}},attempts:1,isCorrect:correct,gameOver:correct,canContinue:false,feedback:Array(5).fill(correct?'green':'red')};}
writePendingGuessJournal({version:1,scope,riddle:first,confirmedClassicIndex:1,base:base(first),draft:Array(5).fill(''),successors:[{riddle:next,base:base(next),draft:['C','L','','',''],draftActiveSlotIndex:2}],queue:[entry(first,'piano','lost-root-guess',true),...(queued?[entry(next,'zzzzz','retained-next-guess',false)]:[])]});
window.readJournal=()=>JSON.parse(localStorage.getItem('riddleQuest:pendingPlay:v1:'+scope)??'null');
let completion,replacementConfirmed=false,authoritativeNext=next;const receipts=new Map();
const fresh={...next,sessionToken:'00000000-0000-4000-8000-000000000099'};window.probe.fresh=fresh;
const services={...source,
 loadRiddle:async input=>{if(input.authoritative&&rejected){await new Promise(resolve=>window.releaseReconcile=resolve);if(replacement){replacementConfirmed=true;return fresh;}if(acceptedDuringReconcile){const result=await source.submitGuess({riddleId:next.riddleId,gameMode:'classic',sessionToken:next.sessionToken,guess:'qqqqq',requestId:'external-owner-accepted'});authoritativeNext={...await source.loadRiddle(input),acceptedGuesses:[{attempt:1,feedback:result.feedback}],revealedHints:[{index:2,letter:'o'}]};return authoritativeNext;}return source.loadRiddle(input);}return input.classicIndex===2?(replacementConfirmed?fresh:authoritativeNext):won;},
 submitGuess:input=>{
  window.probe.guesses.push(input);
  if(!receipts.has(input.requestId))receipts.set(input.requestId,(async()=>{
   if(input.sessionToken===first.sessionToken)await new Promise(()=>{});
   if(rejected&&input.requestId==='retained-next-guess'){await new Promise(resolve=>window.rejectFuture=resolve);throw Object.assign(new Error('Rejected fixture answer'),{code:'failed-precondition'});}
   const result=await source.submitGuess(input);window.probe.nextAccepted=result;
   await new Promise(resolve=>window.releaseFuture=resolve);return result;
  })());return receipts.get(input.requestId);
 },
 spendCoins:async input=>{window.probe.spends.push(input);return source.spendCoins(input);},
 completeGame:input=>{window.probe.completions.push(input);if(!completion)completion=(async()=>{await new Promise(resolve=>window.releaseCompletion=resolve);return source.completeGame(input);})();return completion;},
};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:{schemaVersion:1,updatedAt:10,profile:before,activeGame:null},onPlayerDataChange:update=>window.probe.saves.push(update)});
createRoot(document.querySelector('#root')).render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);
window.profile=()=>source.loadProfile(uid);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'buffered-original-recovery',async load(id){if(baseline&&id.endsWith('/useProvisionalPlayRecovery.ts'))return readFile(path.join(baseline,'useProvisionalPlayRecovery.before.txt'),'utf8');if(reducerBaseline&&id.endsWith('/gameSession.ts'))return readFile(path.join(reducerBaseline,'gameSession.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.BUFFERED_TERMINAL_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});
  const quick=process.env.BUFFERED_TERMINAL_QUICK==='1';
  const rejected=process.env.BUFFERED_TERMINAL_REJECTION_ONLY==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const queued of quick||rejected?[true]:[true,false])for(const beforeNext of rejected&&!quick?[false,true]:[false])for(const variant of process.env.BUFFERED_TERMINAL_REPLACEMENT_ONLY==='1'?['replacement']:process.env.BUFFERED_TERMINAL_CANONICAL_ONLY==='1'?['accepted']:rejected&&!quick?['same','replacement','accepted']:['same']){
   const replacement=variant==='replacement',acceptedDuringReconcile=variant==='accepted';
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const row=async index=>(await page.locator('.guess-row').nth(index).locator('.cell').allTextContents()).join('').toLocaleUpperCase('en');
   const metric=(name,actual,expected)=>{observations.push({width,height,queued,rejected,beforeNext,variant,name,actual,expected});assert.deepEqual(actual,expected,name);};
   await page.goto(url+(rejected?'/?rejected=1'+(replacement?'&replacement=1':'')+(acceptedDuringReconcile?'&acceptedDuringReconcile=1':''):queued?'':'/?draftOnly=1'));await page.locator('.modal-victory').waitFor();await page.waitForFunction(()=>typeof window.releaseCompletion==='function');
   metric('host-confirmed predecessor is never replayed',await page.evaluate(()=>window.probe.guesses.filter(x=>x.sessionToken===window.probe.first.sessionToken).length),0);
   metric('later deliveries wait for predecessor completion',await page.evaluate(()=>window.probe.guesses.length),0);
   metric('retained journal starts at the next issued question',await page.evaluate(()=>window.readJournal()?.riddle.sessionToken),await page.evaluate(()=>window.probe.next.sessionToken));
   metric('later request identity is preserved',await page.evaluate(()=>window.readJournal()?.queue.map(x=>x.message.requestId)),queued?['retained-next-guess']:[]);
   metric('unsubmitted later draft is durable',await page.evaluate(()=>window.readJournal()?.draft),['C','L','','','']);
   metric('draft cursor remains durable',await page.evaluate(()=>window.readJournal()?.draftActiveSlotIndex),2);
   metric('completed predecessor remains visible',await row(0),'PIANO');
   metric('Next waits for completion acknowledgement',await page.locator('.modal-victory button').filter({hasText:/Next/i}).last().isDisabled(),true);
   await page.evaluate(()=>window.releaseCompletion());await page.waitForFunction(()=>window.probe.saves.some(x=>Object.hasOwn(x,'activeGame')&&x.activeGame===null));
   if(queued)await page.waitForFunction(rejected=>typeof window[rejected?'rejectFuture':'releaseFuture']==='function',rejected);
   metric('only the retained later request is delivered',await page.evaluate(()=>window.probe.guesses.map(x=>x.requestId)),queued?['retained-next-guess']:[]);
   if(rejected&&beforeNext){
    await page.evaluate(()=>window.rejectFuture());await page.waitForFunction(()=>typeof window.releaseReconcile==='function');
    await page.evaluate(()=>window.releaseReconcile());await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'&&x.requestId?.startsWith('reconcile-')));
    metric('rejection and reconciliation do not replace the completed victory early',await row(0),'PIANO');
    metric('completed victory remains visible until native dismissal',await page.locator('.modal-victory').count(),1);
   }
   for(let step=0;step<10&&await page.locator('.modal-victory').count();step++){
    if(await page.locator('.coin-award[data-coin-collection="pending"]').count())await page.locator('.coin-award[data-coin-collection="complete"]').waitFor();
    await page.locator('.modal-victory button').filter({hasText:/Next/i}).last().click();await page.waitForTimeout(50);
   }
   await page.getByRole('heading',{name:/What has a face/i}).waitFor();
   if(rejected){
    if(!beforeNext){await page.evaluate(()=>window.rejectFuture());await page.waitForFunction(()=>typeof window.releaseReconcile==='function');}
    metric('rejected successor cannot roll back acknowledged balance',Number((await page.locator('[data-coin-meter] strong').textContent()).replaceAll(',','')),await page.evaluate(async()=>(await window.profile()).coins));
    metric('unsubmitted draft survives rejection until its question is superseded',await row(beforeNext&&acceptedDuringReconcile?1:0),beforeNext&&replacement?'':beforeNext&&acceptedDuringReconcile?'CLO':'CL');
    metric('rejected successor guess is removed',await row(beforeNext&&acceptedDuringReconcile?2:1),'');
    if(!beforeNext){await page.evaluate(()=>window.releaseReconcile());await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:riddleLoaded'&&x.requestId?.startsWith('reconcile-')));}
    metric('draft is retained only when the authoritative reconcile keeps its session',await row(acceptedDuringReconcile?1:0),replacement?'':acceptedDuringReconcile?'CLO':'CL');
    if(!replacement)metric('reconciled draft retains its selected slot',await page.locator('.guess-row').nth(acceptedDuringReconcile?1:0).locator('.cell').nth(acceptedDuringReconcile?3:2).getAttribute('aria-current'),'true');
    if(acceptedDuringReconcile){metric('new accepted host history survives retained-draft restoration',await row(0),'QQQQQ');metric('new host hint remains visible and locked',await page.locator('.guess-row').nth(1).locator('.cell').nth(2).isDisabled(),true);}
    if(replacement){
     metric('replacement session retires the obsolete draft journal',await page.evaluate(()=>window.readJournal()),null);
     await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('qqqqq');await page.locator('.submit-action').click();await page.waitForFunction(()=>typeof window.releaseFuture==='function');
     metric('new submission journal belongs to the replacement session',await page.evaluate(()=>window.readJournal()?.riddle.sessionToken),await page.evaluate(()=>window.probe.fresh.sessionToken));
     await page.evaluate(()=>window.releaseFuture());await page.waitForFunction(()=>window.readJournal()===null);
     metric('replacement session accepts exactly one new wrong row',await row(0),'QQQQQ');
    }
    metric('rollback never replays completed predecessor',await page.evaluate(()=>window.probe.guesses.filter(x=>x.sessionToken===window.probe.first.sessionToken).length),0);
    metric('rejected answer is not automatically resubmitted',await page.evaluate(()=>window.probe.guesses.filter(x=>x.requestId==='retained-next-guess').length),1);
   }
   if(!rejected){
   metric('later wrong row is restored exactly once',await row(0),queued?'ZZZZZ':'CL');
   metric('later draft survives victory dismissal',await row(queued?1:0),'CL');
   metric('later draft cursor survives victory dismissal',await page.locator('.guess-row').nth(queued?1:0).locator('.cell').nth(2).getAttribute('aria-current'),'true');
   metric('restoring old journal gameplay preserves the authoritative completion balance',Number((await page.locator('[data-coin-meter] strong').textContent()).replaceAll(',','')),await page.evaluate(async()=>(await window.profile()).coins));
   if(queued){
    await page.evaluate(()=>window.releaseFuture());
    await page.waitForFunction(()=>window.probe.inbound.some(x=>x.type==='host:operationResult'&&x.requestId==='retained-next-guess'&&x.payload.operation==='guess'&&x.payload.ok));
    await page.waitForFunction(()=>window.readJournal()?.queue.length===0);
    metric('acknowledged successor leaves no replayable delivery',await page.evaluate(()=>{const j=window.readJournal();return[j?.queue,j?.successors,j?.coinAction??null,j?.skipPreview??null];}),[[],[],null,null]);
    metric('settled journal retains only the matching successor draft',await page.evaluate(()=>{const j=window.readJournal();return[j?.scope,j?.riddle.riddleId,j?.riddle.sessionToken,j?.riddle.gameMode,j?.riddle.index,j?.confirmedClassicIndex,j?.draft,j?.draftActiveSlotIndex];}),await page.evaluate(()=>['jest-guest:1:en',window.probe.next.riddleId,window.probe.next.sessionToken,'classic',2,2,['C','L','','',''],2]));
    metric('settled checkpoint contains the acknowledged wrong row exactly once',await page.evaluate(()=>{const j=window.readJournal();return[j?.base.guesses,j?.base.engineSnapshot?.attemptsUsed,j?.base.currentLetters,j?.base.activeSlotIndex,j?.base.engineSnapshot?.gameOver,j?.base.lastOutcome];}),[[{guess:['z','z','z','z','z'],feedback:['red','red','red','red','red']}],1,['C','L','','',''],2,false,null]);
   }
   }
   metric('authority completion advances once',await page.evaluate(async()=>{const p=await window.profile(),b=window.probe.before;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins,p.classicIndex];}),[1,1,2]);
   metric('recovery introduces no paid action',await page.evaluate(()=>window.probe.spends),[]);
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type(acceptedDuringReconcile?'c':'o');
   metric('restored draft accepts native typing at its selected slot',await row((queued&&!rejected)||replacement||acceptedDuringReconcile?1:0),replacement?'O':acceptedDuringReconcile?'CLOC':'CLO');
   if(!queued)metric('draft-only edits remain durable after prefix retirement',await page.evaluate(()=>window.readJournal()?.draft),['C','L','O','','']);
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,`${width}-${height}-${queued?'queued':'draft-only'}${rejected?(beforeNext?'-rejected-before-next':'-rejected-after-next'):''}-${variant}.png`)});await context.close();
  }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe,journal:window.readJournal()})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
