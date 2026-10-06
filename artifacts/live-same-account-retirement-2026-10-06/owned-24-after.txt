import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.LIVE_SAME_REACT_MODE??'development';
const output=path.resolve(process.env.LIVE_SAME_REPORT_DIR??path.join(root,'../../artifacts/live-same-account-retirement-2026-10-06',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-same-account-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {RACE_RULES,LiveRaceViewSchema} from '@qwordly/core/race';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URLSearchParams(location.search).get('scenario')??'late-join';
window.probe={joins:[],updates:[],subscriptions:[],grants:[],retirements:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const seat={ticket:'a'.repeat(64),start:Date.now()-1000,correct:0,left:false},listeners=new Set(),intents=new Map();let activeJoin=null,holdJoin=scenario==='late-join',holdLeave=scenario==='delayed-leave';
function view(){const now=Date.now();return LiveRaceViewSchema.parse({ticketId:seat.ticket,phase:seat.left?'cancelled':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,
player:{displayName:'Same account',avatarUrl:null,bot:false,correctCount:seat.correct},opponent:{displayName:'Bob',avatarUrl:null,bot:false,correctCount:0},result:null,rewardCoins:0,
run:seat.left?null:{runId:seat.ticket,role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]}}});}
function adapter(generation){return {
 join:async input=>{if(seat.left){seat.ticket='c'.repeat(64);seat.left=false;seat.correct=0;}if(intents.get(input.requestId)?.retired)throw Object.assign(new Error('Join retired'),{code:'functions/failed-precondition'});if(!intents.has(input.requestId)){intents.set(input.requestId,{ticketId:seat.ticket,retired:false});activeJoin=input.requestId;}window.probe.joins.push({generation,ticketId:seat.ticket,...input});window.afterSecondJoin?.();window.afterSecondJoin=null;const value=view();if(generation===1&&holdJoin){holdJoin=false;return new Promise(resolve=>window.releaseJoin=()=>{window.releaseJoin=null;resolve(value);});}return value;},
 retireJoin:async input=>{window.probe.retirements.push({generation,...input});
  if(generation===1&&scenario==='late-join'&&window.probe.retirements.filter(x=>x.generation===1).length===1)throw Object.assign(new Error('Outage before authority'),{code:'functions/unavailable'});
  const intent=intents.get(input.requestId);if(!intent){intents.set(input.requestId,{retired:true});return {status:'retired'};}intent.retired=true;
  if(generation===1&&holdLeave){holdLeave=false;await new Promise(resolve=>window.releaseLeave=()=>{window.releaseLeave=null;resolve();});}
  if(generation===1&&window.probe.joins.filter(x=>x.generation===2).length===0)await new Promise(resolve=>window.afterSecondJoin=resolve);
  if(activeJoin!==input.requestId)return {status:'superseded'};
  seat.left=true;queueMicrotask(()=>{for(const refresh of listeners)refresh();});return {status:'retired'};
 },update:async input=>{window.probe.updates.push({generation,...input});if(input.ticketId!==seat.ticket)throw Object.assign(new Error('Stale terminal ticket'),{code:'functions/not-found'});
  if(input.action==='leave'){
   if(generation===1&&holdLeave){holdLeave=false;await new Promise(resolve=>window.releaseLeave=()=>{window.releaseLeave=null;resolve();});}
   if(generation===1&&scenario==='late-join'&&window.probe.updates.filter(x=>x.generation===1&&x.action==='leave').length===1)throw Object.assign(new Error('Outage before authority'),{code:'functions/unavailable'});
   seat.left=true;queueMicrotask(()=>{for(const refresh of listeners)refresh();});
  }
  if(input.action==='guess'){if(input.guess.toLowerCase()!=='piano')throw Error('Unexpected guess');seat.correct++;}
  return view();
 },observe(ticketId,refresh,status){window.probe.subscriptions.push({generation,ticketId});listeners.add(refresh);status(true);return ()=>listeners.delete(refresh);}
};}
const providers=[null,adapter(1),adapter(2)],catalog=await createFakeRaceServices().listRaceCategories({locale:'en'});
window.authority=()=>({ticketId:seat.ticket,left:seat.left,correct:seat.correct});
function App(){const [generation,setGeneration]=React.useState(1);window.replace=()=>setGeneration(2);return <div data-generation={generation}><RaceTo10Game locale='en' ownerId='same-authenticated-account' coins={100} initialCategories={catalog.categories} postToHost={()=>{}} matchmaking={{live:providers[generation]}} onLiveResult={value=>window.probe.grants.push({generation,ticketId:value.ticketId})} onClose={()=>{}}/></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'same-account-baseline',enforce:'pre',async load(id){const baseline=process.env.LIVE_SAME_BASELINE_DIR;if(baseline&&id.endsWith('/LiveRaceGame.tsx'))return readFile(path.join(baseline,'LiveRaceGame.before.txt'),'utf8');if(baseline&&id.endsWith('/liveRaceRetirement.ts'))return readFile(path.join(baseline,'retirement.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browserName=process.env.LIVE_SAME_BROWSER??'chromium';browser=await (browserName==='firefox'?firefox:chromium).launch({headless:true,...(browserName==='firefox'&&process.env.LIVE_SAME_FIREFOX_EXECUTABLE?{executablePath:process.env.LIVE_SAME_FIREFOX_EXECUTABLE}:{})});
 for(const [width,height] of process.env.LIVE_SAME_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of ['late-join','delayed-leave']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?scenario='+scenario);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();
  if(scenario==='late-join')await page.waitForFunction(()=>Boolean(window.releaseJoin));else await page.locator('.race-native-answer-input').waitFor();
  await page.evaluate(()=>window.replace());await page.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();
  if(scenario==='delayed-leave')await page.waitForFunction(()=>Boolean(window.releaseLeave));
  await page.getByRole('button',{name:'Start PvP match',exact:true}).click();await page.locator('.race-native-answer-input').waitFor();
  metric('replacement adapter recovers the same canonical account ticket',await page.evaluate(()=>window.probe.joins.map(x=>x.ticketId)),Array(2).fill('a'.repeat(64)));
  await page.evaluate(scenario=>scenario==='late-join'?window.releaseJoin():window.releaseLeave(),scenario);
  if(scenario==='late-join')await page.waitForFunction(()=>window.probe.retirements.filter(x=>x.generation===1).length>=2||window.probe.updates.filter(x=>x.generation===1&&x.action==='leave').length>=2);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  metric('retired cleanup does not cancel the resumed server seat',await page.evaluate(()=>window.authority().left),false);
  metric('resumed journey retains its native editor',await page.locator('.race-native-answer-input').count(),1);
  metric('modern retirement never sends an unconditional ticket leave',await page.evaluate(()=>window.probe.updates.filter(x=>x.generation===1&&x.action==='leave').length),0);
  metric('original join identity owns every retirement retry',await page.evaluate(()=>window.probe.retirements.filter(x=>x.generation===1).every(x=>x.requestId===window.probe.joins[0].requestId&&x.expectedOwnerId==='same-authenticated-account')),true);
  if(await page.locator('.race-native-answer-input').count()){await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.authority().correct===1);}
  metric('resumed seat remains playable after old cleanup',await page.evaluate(()=>window.authority().correct),1);
  metric('old receipts do not grant a completion',await page.evaluate(()=>window.probe.grants),[]);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Resumed same-account seat ownership');
