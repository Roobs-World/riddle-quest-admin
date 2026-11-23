import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.LIVE_WAIT_REACT_MODE??'development',baseline=process.env.LIVE_WAIT_BASELINE_DIR;
const output=path.resolve(process.env.LIVE_WAIT_REPORT_DIR??path.join(root,'builds/test-evidence/live-wait-retirement-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-wait-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/web/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import {RACE_RULES,LiveRaceViewSchema} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URLSearchParams(location.search).get('scenario')??'idle';
window.probe={requests:[],joins:[],subscriptions:[],active:[0,0,0],grants:[],closes:[],events:[],retirements:[],renders:[],errors:[],unhandled:[]};
window.pendingDeliveryTimers=new Map();const timeout=window.setTimeout,clear=window.clearTimeout;window.setTimeout=function(callback,delay,...args){const tracked=[2000,10000,30000].includes(delay)&&new Error().stack.includes('liveRaceDeliveryDeadline');let id;id=timeout.call(this,(...values)=>{window.pendingDeliveryTimers.delete(id);callback(...values);},delay,...args);if(tracked)window.pendingDeliveryTimers.set(id,delay);return id;};window.clearTimeout=function(id){window.pendingDeliveryTimers.delete(id);return clear.call(this,id);};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:live-race-completed',e=>window.probe.events.push(e.detail));
const listeners=[new Set(),new Set(),new Set()],held=new Map(),acceptedLeaves=new Set();
function snapshot(seat){const now=Date.now(),player={displayName:'Provider '+seat.generation,avatarUrl:null,bot:false,correctCount:seat.correct},opponent={displayName:'Bob',avatarUrl:null,bot:false,correctCount:0};
 return LiveRaceViewSchema.parse({ticketId:seat.ticket,phase:seat.terminal?'result':seat.left?'cancelled':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player,opponent,result:seat.terminal?'win':null,rewardCoins:seat.terminal?50:0,...(seat.terminal?{newCoins:150}:{}),run:seat.left&&!seat.terminal?null:{runId:seat.ticket,role:'creator',status:seat.terminal?'completed':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:seat.terminal?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function receipt(generation,action,value){if(window.hold?.generation===generation&&window.hold?.action===action){window.hold=null;return new Promise(resolve=>held.set(generation,()=>{held.delete(generation);resolve(value);}));}return Promise.resolve(value);}
function adapter(generation,audience=false){const seat={generation,ticket:(generation===1?'a':'b').repeat(64),start:Date.now()-1000,correct:0,terminal:false,left:false};
 return {join:input=>{window.probe.joins.push({generation,audience,...input});return receipt(generation,'join',snapshot(seat));},update:input=>{window.probe.requests.push({generation,...input});
 if(input.ticketId!==seat.ticket)return Promise.reject(Object.assign(new Error('Cross-provider ticket'),{code:'functions/invalid-argument'}));
 if(input.action==='guess'){if(input.guess.toLowerCase()!=='piano')throw Error('Unexpected fixture guess');seat.correct++;if(window.terminalNext){window.terminalNext=false;seat.correct=10;seat.terminal=true;}}
 if(input.action==='leave'){seat.left=true;const key=generation+':'+input.requestId;if(!acceptedLeaves.has(key)){acceptedLeaves.add(key);window.probe.retirements.push({generation,requestId:input.requestId});}}
 return receipt(generation,input.action,snapshot(seat));},observe(ticketId,refresh,status){window.probe.subscriptions.push({generation,ticketId});window.probe.active[generation]++;listeners[generation].add(refresh);status(true);return ()=>{window.probe.active[generation]--;listeners[generation].delete(refresh);};}};}
const providers=[null,adapter(1),adapter(2)],audience=adapter(1,true);providers[1].chooseChallenge=async()=>({status:'success',value:audience});const catalog=await createFakeRaceServices().listRaceCategories({locale:'en'});
window.notify=generation=>{for(const refresh of [...listeners[generation]])refresh();};window.release=generation=>held.get(generation)?.();window.held=generation=>held.has(generation);window.capturePoll=()=>held.get(1);
if(scenario==='join')window.hold={generation:1,action:'join'};
const waitForever=new Promise(()=>{});function SuspendedRender(){throw waitForever;}
function App(){const [generation,setGeneration]=React.useState(1),[owner,setOwner]=React.useState('Owner'),[epoch,setEpoch]=React.useState(0),[removed,setRemoved]=React.useState(false);
 window.probe.renders.push(generation);window.refresh=()=>setEpoch(x=>x+1);window.replace=()=>setGeneration(2);window.replaceOwner=()=>setOwner('New owner');window.remove=()=>setRemoved(true);window.speculate=()=>React.startTransition(()=>setGeneration(2));
 React.useLayoutEffect(()=>{if(window.releaseDuringCommit&&(generation===2||owner==='New owner'||removed)){window.releaseDuringCommit=false;window.release(1);}},[generation,owner,removed]);
 return <React.Suspense fallback={<p>Pending fixture render</p>}><div data-generation={generation} data-owner={owner} data-epoch={epoch}><RaceTo10Game locale='en' ownerId={owner} coins={100+epoch} initialCategories={catalog.categories} postToHost={()=>{}} matchmaking={removed?undefined:{live:providers[generation]}} onLiveResult={view=>window.probe.grants.push({generation,owner,ticketId:view.ticketId})} onClose={()=>window.probe.closes.push({generation,owner})}/>{scenario==='speculative'&&generation===2?<SuspendedRender/>:null}</div></React.Suspense>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-wait-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/LiveRaceGame.tsx'))return readFile(path.join(baseline,'LiveRaceGame.before.txt'),'utf8');if(baseline&&id.endsWith('/liveRaceDeliveryDeadline.ts'))return readFile(path.join(baseline,'deadline.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_WAIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});const quick=process.env.LIVE_WAIT_QUICK==='1';
 for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_WAIT_SCENARIOS?.split(',')??(quick?['join']:['join','poll','overlap','guess','terminal','leave','commit','owner-commit','remove-commit','stable','speculative'])) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});};
  await page.goto(url+'/?scenario='+scenario);if(scenario==='private')await page.locator('.live-race-context-challenge').click();else await page.getByRole('button',{name:'Start PvP match',exact:true}).click();
  const input=page.locator('.race-native-answer-input'),intro=page.getByRole('button',{name:'Start PvP match',exact:true}),letters=()=>page.locator('.guess-row:has([aria-current="true"]) button').allTextContents().then(values=>values.join('').toLowerCase());
  if(scenario==='join')await page.waitForFunction(()=>window.held(1));else {await input.waitFor();await page.waitForFunction(()=>window.probe.active[1]===1);if(scenario!=='idle-minimal'){await input.focus();await page.keyboard.type('pian');metric('old provider owns a native draft',await letters(),'pian');}}
  if(scenario==='private')metric('private audience owns its selected transport',await page.evaluate(()=>window.probe.joins[0].audience),true);
  if(scenario==='poll')await page.evaluate(()=>{window.hold={generation:1,action:'poll'};window.notify(1);});
  if(scenario==='overlap')await page.evaluate(()=>{window.hold={generation:1,action:'poll'};window.notify(1);window.releasePoll=window.capturePoll();});
  if(['overlap','guess','terminal','commit','owner-commit','remove-commit','speculative'].includes(scenario)){await page.evaluate(scenario=>{window.hold={generation:1,action:'guess'};window.terminalNext=scenario!=='guess';},scenario);await page.keyboard.type('o');await page.keyboard.press('Enter');}
  if(scenario==='leave'){await page.evaluate(()=>window.hold={generation:1,action:'leave'});await page.keyboard.press('Escape');}
  if(!['idle','idle-minimal','private','stable'].includes(scenario)){await page.waitForFunction(()=>window.held(1));metric('held delivery owns its expected deadline',await page.evaluate(()=>[...window.pendingDeliveryTimers.values()]),scenario==='overlap'?[2000,10000]:[scenario==='join'?30000:scenario==='poll'?2000:10000]);}
  if(scenario==='stable'){
   await page.evaluate(()=>{window.editor=document.querySelector('.race-native-answer-input');window.before={requests:window.probe.requests.length,subscriptions:window.probe.subscriptions.length,joins:window.probe.joins.length};});
   for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(epoch=>document.querySelector('[data-epoch]')?.getAttribute('data-epoch')===String(epoch),i+1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
   metric('stable adapter keeps the native editor and focus',await page.evaluate(()=>window.editor===document.querySelector('.race-native-answer-input')&&document.activeElement===window.editor),true);
   metric('stable adapter preserves the draft',await letters(),'pian');metric('ordinary profile updates do not restart delivery',await page.evaluate(()=>({requests:window.probe.requests.length-window.before.requests,subscriptions:window.probe.subscriptions.length-window.before.subscriptions,joins:window.probe.joins.length-window.before.joins})),{requests:0,subscriptions:0,joins:0});
   await page.keyboard.type('o');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('stable journey advances once',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='guess').length),1);
  } else if(scenario==='speculative'){
   await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.renders.includes(2));metric('uncommitted provider replacement keeps the original journey',await page.locator('[data-generation]').getAttribute('data-generation'),'1');metric('uncommitted replacement retains the owned subscription',await page.evaluate(()=>window.probe.active.slice(1)),[1,0]);
   await page.evaluate(()=>window.release(1));await page.locator('.live-race-victory').waitFor();metric('current receipt completes through the committed provider callback',await page.evaluate(()=>window.probe.grants),[{generation:1,owner:'Owner',ticketId:'a'.repeat(64)}]);metric('current receipt emits one committed owner event',await page.evaluate(()=>window.probe.events),[{ownerId:'Owner'}]);metric('uncommitted replacement never joins another seat',await page.evaluate(()=>window.probe.joins.map(x=>x.generation)),[1]);
  } else {
   await page.evaluate(scenario=>{window.releaseDuringCommit=scenario.includes('commit');if(scenario==='owner-commit')window.replaceOwner();else if(scenario==='remove-commit')window.remove();else window.replace();},scenario);
   await page.waitForFunction(scenario=>scenario==='owner-commit'?document.querySelector('[data-owner]')?.getAttribute('data-owner')==='New owner':scenario==='remove-commit'||document.querySelector('[data-generation]')?.getAttribute('data-generation')==='2',scenario);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   metric('retirement releases every local delivery deadline',await page.evaluate(()=>window.pendingDeliveryTimers.size),0);
   const hasIntro=await intro.count()>0;metric('replacement retires the selected journey before a fresh explicit start',hasIntro,true);
   metric('replacement removes the old subscription',await page.evaluate(()=>window.probe.active.slice(1)),[0,0]);
   metric('replacement never uses the retired ticket through a new adapter',await page.evaluate(()=>window.probe.requests.filter(x=>x.generation===2&&x.ticketId==='a'.repeat(64)).length),0);
   metric('replacement cannot deliver a retired result to the current profile',await page.evaluate(()=>window.probe.grants),[]);metric('replacement cannot emit a retired completion event',await page.evaluate(()=>window.probe.events),[]);
   const startsReplacement=scenario!=='remove-commit'&&scenario!=='owner-commit';
   if(startsReplacement){if(hasIntro){await intro.click();await input.waitFor();await page.waitForFunction(()=>window.probe.active[2]===1);}
    metric('new provider joins an independent seat',await page.evaluate(()=>window.probe.joins.map(x=>x.generation)),[1,2]);metric('new join has an independent idempotency key',await page.evaluate(()=>new Set(window.probe.joins.map(x=>x.requestId)).size),2);metric('new provider begins with a clean draft',await letters(),'');}
   if(!scenario.includes('commit')&&scenario!=='idle'&&scenario!=='idle-minimal'&&scenario!=='private')await page.evaluate(()=>{window.release(1);window.releasePoll?.();});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   metric('late retired receipt cannot grant a result',await page.evaluate(()=>window.probe.grants),[]);metric('late retired receipt cannot notify completion',await page.evaluate(()=>window.probe.events),[]);metric('late retired leave cannot close the replacement journey',await page.evaluate(()=>window.probe.closes),[]);
   /* A terminal receipt released inside the replacement commit completes the old seat before its unmount cleanup; liveRaceRetirement deliberately sends no leave for a finished race. */const completedBeforeRetirement=scenario.includes('commit');metric('old seat retires under its original provider once',await page.evaluate(()=>window.probe.retirements.map(x=>x.generation)),completedBeforeRetirement?[]:[1]);metric('retirement retries share one key',await page.evaluate(()=>new Set(window.probe.requests.filter(x=>x.generation===1&&x.action==='leave').map(x=>x.requestId)).size),completedBeforeRetirement?0:1);
   if(startsReplacement){metric('new provider retains its own subscription after the old receipt',await page.evaluate(()=>window.probe.active.slice(1)),[0,1]);metric('new subscription addresses its own ticket',await page.evaluate(()=>window.probe.subscriptions.filter(x=>x.generation===2).at(-1)?.ticketId??null),'b'.repeat(64));metric('old receipt cannot advance the new seat',await page.locator('.race-progress > div:first-child strong').count()?await page.locator('.race-progress > div:first-child strong').textContent():null,'Riddles completed: 0 / 10');let submitted='blocked by retained seat';if(hasIntro){await input.focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));submitted=await page.evaluate(()=>window.probe.requests.filter(x=>x.generation===2&&x.action==='guess').map(x=>x.ticketId));}metric('replacement journey remains playable',submitted,['b'.repeat(64)]);}

  }
  metric('settled journey retains no delivery deadline',await page.evaluate(()=>window.pendingDeliveryTimers.size),0);metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_WAIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live wait retirement assertions');
