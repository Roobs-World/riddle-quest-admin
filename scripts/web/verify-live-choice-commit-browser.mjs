import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.LIVE_CHOICE_REACT_MODE??'development',baseline=process.env.LIVE_CHOICE_BASELINE_DIR;
const output=path.resolve(process.env.LIVE_CHOICE_REPORT_DIR??path.join(root,'builds/test-evidence/live-choice-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-choice-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,"src/races/components/recorded/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {RACE_RULES,LiveRaceViewSchema} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URLSearchParams(location.search).get('scenario')??'idle';
window.probe={requests:[],joins:[],subscriptions:[],active:[0,0,0],grants:[],closes:[],events:[],retirements:[],renders:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:live-race-completed',e=>window.probe.events.push(e.detail));
const acceptedLeaves=new Set();
function snapshot(seat){const now=Date.now(),player={displayName:'Provider '+seat.generation,avatarUrl:null,bot:false,correctCount:seat.correct},opponent={displayName:'Bob',avatarUrl:null,bot:false,correctCount:0};
 return LiveRaceViewSchema.parse({ticketId:seat.ticket,phase:seat.terminal?'result':seat.left?'cancelled':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player,opponent,result:seat.terminal?'win':null,rewardCoins:seat.terminal?50:0,...(seat.terminal?{newCoins:150}:{}),run:seat.left&&!seat.terminal?null:{runId:seat.ticket,role:'creator',status:seat.terminal?'completed':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:seat.terminal?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function adapter(generation,audience=false){const seat={generation,ticket:(generation===1?'a':'b').repeat(64),start:Date.now()-1000,correct:0,terminal:false,left:false};
 return {join:input=>{window.probe.joins.push({generation,audience,...input});return Promise.resolve(snapshot(seat));},update:input=>{window.probe.requests.push({generation,...input});
 if(input.ticketId!==seat.ticket)return Promise.reject(Object.assign(new Error('Cross-provider ticket'),{code:'functions/invalid-argument'}));
 if(input.action==='guess'){if(input.guess.toLowerCase()!=='piano')throw Error('Unexpected fixture guess');seat.correct++;}
 if(input.action==='leave'){seat.left=true;const key=generation+':'+input.requestId;if(!acceptedLeaves.has(key)){acceptedLeaves.add(key);window.probe.retirements.push({generation,requestId:input.requestId});}}
 return Promise.resolve(snapshot(seat));},observe(ticketId,refresh,status){window.probe.subscriptions.push({generation,ticketId});window.probe.active[generation]++;status(true);return ()=>{window.probe.active[generation]--;};}};}
const providers=[null,adapter(1),adapter(2)],audience=adapter(1,true);providers[1].chooseChallenge=()=>{window.probe.choices=(window.probe.choices??0)+1;return new Promise((resolve,reject)=>{window.releaseChoice=()=>resolve(window.choiceResult??{status:'success',value:audience});window.rejectChoice=()=>reject(new Error('Fixture chooser unavailable'));});};const catalog=await createFakeRaceServices().listRaceCategories({locale:'en'});
let unblock;const pending=new Promise(resolve=>{unblock=resolve;});window.unblock=unblock;function SuspendedRender(){window.probe.suspended=(window.probe.suspended??0)+1;throw pending;}
function App(){const [generation,setGeneration]=React.useState(1),[owner,setOwner]=React.useState('Owner'),[epoch,setEpoch]=React.useState(0),[removed,setRemoved]=React.useState(false),[mounted,setMounted]=React.useState(true);
 window.probe.renders.push(generation);window.refresh=()=>setEpoch(x=>x+1);window.replace=()=>setGeneration(2);window.replaceOwner=()=>setOwner('New owner');window.remove=()=>setRemoved(true);window.speculate=()=>React.startTransition(()=>setGeneration(2));window.restore=()=>setGeneration(1);window.retire=()=>setMounted(false);window.commit=()=>{window.allowB=true;unblock();setGeneration(2);};
 React.useLayoutEffect(()=>{if(window.releaseDuringCommit&&(generation===2||owner==='New owner'||removed)){window.releaseDuringCommit=false;if(window.rejectDuringCommit)window.rejectChoice();else window.releaseChoice();}},[generation,owner,removed]);
 return <React.Suspense fallback={<p>Pending fixture render</p>}><div data-generation={generation} data-owner={owner} data-epoch={epoch}>{mounted?<RaceTo10Game locale='en' ownerId={owner} coins={100+epoch} initialCategories={catalog.categories} postToHost={()=>{}} matchmaking={removed?undefined:{live:providers[generation]}} onLiveResult={view=>window.probe.grants.push({generation,owner,ticketId:view.ticketId})} onClose={()=>window.probe.closes.push({generation,owner})}/>:<p data-retired>Retired</p>}{['speculative','abandon','commit-after-pending','accept-before-commit'].includes(scenario)&&generation===2&&!window.allowB?<SuspendedRender/>:null}</div></React.Suspense>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-choice-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/RaceTo10Game.tsx'))return readFile(path.join(baseline,'RaceTo10Game.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_CHOICE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_CHOICE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_CHOICE_SCENARIOS?.split(',')??['speculative','abandon','commit-after-pending','replace','replace-commit','replace-error-commit','replace-rejection-commit','owner-commit','remove-commit','retire','stable','accept-before-commit','cancelled','failed','rejected']) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.locator('.live-race-context-challenge').click();await page.waitForFunction(()=>window.probe.choices===1);
  metric('pending native chooser disables repeated selection',await page.locator('.live-race-context-challenge').isDisabled(),true);
  metric('pending native chooser has not joined a seat',await page.evaluate(()=>window.probe.joins),[]);
  if(['speculative','abandon','commit-after-pending','accept-before-commit'].includes(scenario)){
   await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.suspended>0);
   metric('suspended replacement retains the committed provider lobby',await page.locator('[data-generation]').getAttribute('data-generation'),'1');
   metric('suspended replacement retains the pending chooser',await page.locator('.live-race-context-challenge').isDisabled(),true);
   if(scenario==='abandon'){await page.evaluate(()=>{window.restore();window.allowB=true;window.unblock();});await page.waitForTimeout(40);}
   if(scenario==='commit-after-pending'){await page.evaluate(()=>window.commit());await page.waitForFunction(()=>document.querySelector('[data-generation]')?.dataset.generation==='2');}
  }else if(['replace','replace-commit','replace-error-commit','replace-rejection-commit','owner-commit','remove-commit'].includes(scenario)){
   await page.evaluate(scenario=>{window.releaseDuringCommit=scenario.endsWith('commit');if(scenario==='replace-error-commit')window.choiceResult={status:'error'};if(scenario==='replace-rejection-commit')window.rejectDuringCommit=true;if(scenario==='owner-commit')window.replaceOwner();else if(scenario==='remove-commit')window.remove();else window.replace();},scenario);
   await page.waitForFunction(scenario=>scenario==='owner-commit'?document.querySelector('[data-owner]')?.dataset.owner==='New owner':scenario==='remove-commit'?document.querySelector('.race-error')!=null:document.querySelector('[data-generation]')?.dataset.generation==='2',scenario);
  }else if(scenario==='retire'){await page.evaluate(()=>window.retire());await page.locator('[data-retired]').waitFor();}
  else if(scenario==='stable')for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}
  await page.evaluate(scenario=>{if(scenario==='cancelled')window.choiceResult={status:'cancelled'};if(scenario==='failed')window.choiceResult={status:'error'};if(scenario==='rejected')window.rejectChoice();else window.releaseChoice();},scenario);
  await page.waitForTimeout(100);
  const accepts=['speculative','abandon','stable','accept-before-commit'].includes(scenario),joined=await page.evaluate(()=>window.probe.joins.map(x=>({generation:x.generation,audience:x.audience,categoryId:x.categoryId,createChallenge:x.createChallenge})));
  metric('only committed chooser ownership may create its reserved seat',joined,accepts?[{generation:1,audience:true,categoryId:'mixed',createChallenge:true}]:[]);
  metric('one player selection invokes the native chooser once',await page.evaluate(()=>window.probe.choices),1);
  if(accepts&&joined.length){
   const input=page.locator('.race-native-answer-input');await input.waitFor();await input.focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));
   metric('reserved seat remains playable through its chosen audience',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='guess').map(x=>x.generation)),[1]);
   metric('reserved seat owns one active provider subscription',await page.evaluate(()=>window.probe.active.slice(1)),[1,0]);
  }
  if(scenario==='accept-before-commit'&&joined.length){await page.evaluate(()=>window.commit());await page.waitForFunction(()=>document.querySelector('[data-generation]')?.dataset.generation==='2');await page.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();metric('later provider commit retires the accepted audience seat under its original provider',await page.evaluate(()=>window.probe.retirements.map(x=>x.generation)),[1]);metric('later provider commit releases the accepted audience subscription',await page.evaluate(()=>window.probe.active.slice(1)),[0,0]);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();await page.locator('.race-native-answer-input').waitFor();metric('later explicit start belongs to the replacement provider',await page.evaluate(()=>window.probe.joins.map(x=>x.generation)),[1,2]);}
  if(['cancelled','failed','rejected'].includes(scenario)){metric('settled chooser allows a new player choice',await page.locator('.live-race-context-challenge').isEnabled(),true);metric('cancelled chooser stays quiet and failures display recovery',await page.locator('.race-error').count(),scenario==='cancelled'?0:1);}
  if(['replace-error-commit','replace-rejection-commit'].includes(scenario))metric('retired chooser failure cannot display recovery in the replacement lobby',await page.locator('.race-error').count(),0);
  if(['replace','replace-commit','replace-error-commit','replace-rejection-commit','commit-after-pending'].includes(scenario)){await page.getByRole('button',{name:'Start PvP match',exact:true}).click();await page.locator('.race-native-answer-input').waitFor();metric('committed replacement can start an independent seat',await page.evaluate(()=>window.probe.joins.map(x=>x.generation)),[2]);}
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_CHOICE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_CHOICE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live native chooser ownership assertions');
