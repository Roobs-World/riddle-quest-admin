import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.LIVE_COUNTDOWN_REACT_MODE??'development',baseline=process.env.LIVE_COUNTDOWN_BASELINE_FILE;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.LIVE_COUNTDOWN_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-countdown-clock-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-countdown-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES,LiveRaceViewSchema} from '@riddle-quest/core/race';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={samples:0,wakeups:0,slots:[],active:new Map(),calls:[],errors:[],unhandled:[],offset:0,joins:0};
window.addEventListener('error',e=>probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>probe.unhandled.push(String(e.reason)));
let hidden=new URLSearchParams(location.search).has('hidden');Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
const nativeNow=performance.now.bind(performance);performance.now=()=>nativeNow()+probe.offset;
const nativeInterval=window.setInterval.bind(window),nativeClear=window.clearInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{const tracked=(String(callback).includes('sampleCountdown')||String(callback).includes('probe.samples'));const id=nativeInterval(tracked?()=>{probe.wakeups++;callback(...args);}:callback,delay,...args);if(tracked){probe.slots.push(callback);probe.active.set(id,callback);}return id;};
window.clearInterval=id=>{probe.active.delete(id);nativeClear(id);};
const starts=Date.now()+60000,anchor=performance.now(),ticket='a'.repeat(64);let forceResult=false;
window.expectedElapsed=()=>Math.max(0,Math.floor(performance.now()-anchor-60000));
const snapshot=()=>{const now=Math.floor(starts-60000+performance.now()-anchor),phase=forceResult?'cancelled':now>=starts?'racing':'countdown',identity=name=>({displayName:name,avatarUrl:null,bot:false,correctCount:0});return LiveRaceViewSchema.parse({ticketId:ticket,phase,serverNowMs:now,startsAtMs:starts,searchEndsAtMs:starts+60000,player:identity('Alice'),opponent:identity('Bob'),result:null,rewardCoins:0,run:{runId:ticket,role:'creator',status:forceResult?'abandoned':phase==='racing'?'active':'scheduled',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:0,wallElapsedMs:Math.max(0,now-starts),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-starts),events:[],serverNowMs:now,startsAtMs:starts,currentRiddle:{riddleId:'q0',text:'A four-letter browser answer',answerLength:4,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',adjustedFinishMs:300000,events:[]}}});};
const transport={join:async()=>{probe.joins++;return snapshot();},update:async input=>{probe.calls.push(input.action);if(input.action==='leave')forceResult=true;return snapshot();}};
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);return <><nav style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white'}}><button data-hide onClick={()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));}}>Hide fixture</button><button data-show onClick={()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));probe.afterVisibilitySamples=probe.samples;}}>Show fixture</button><button data-advance onClick={()=>{probe.offset+=65000;}}>Advance clock</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button><button data-mount onClick={()=>setMounted(x=>!x)}>Mount or retire</button><span>{epoch}</span></nav>{mounted?<LiveRaceGame transport={transport} locale='en' categoryId='mixed' ownerId='Alice' coins={100} onClose={()=>setMounted(false)}/>:<p data-retired>Retired fixture</p>}</>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-countdown-probe',enforce:'pre',async load(id){if(id.endsWith('/race/LiveRaceGame.tsx')){const source=await readFile(baseline??id,'utf8');assert(source.includes('const sampledNow = serverNow();'));return source.replace('const sampledNow = serverNow();','window.probe.samples++; const sampledNow = serverNow();');}}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_COUNTDOWN_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_COUNTDOWN_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_COUNTDOWN_CASES?.split(',')??['hidden','initially-hidden','parent','cycles','retired']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const counters=()=>page.evaluate(()=>({samples:probe.samples,wakeups:probe.wakeups,active:probe.active.size,slots:probe.slots.length}));
  await page.goto(url+(scenario==='initially-hidden'?'?hidden=1':''));await page.locator('.live-race-search-wheel[data-phase=countdown]').waitFor();await settle();
  metric('one accepted join owns the countdown',await page.evaluate(()=>probe.joins),1);
  metric('initial clock ownership matches visibility',(await counters()).active,scenario==='initially-hidden'?0:1);
  await page.locator('[data-hide]').click();await settle();const before=await counters();metric('hidden countdown owns no animation timer',before.active,0);
  await page.evaluate(()=>probe.slots.forEach(callback=>callback()));metric('queued cancelled countdown callbacks cannot sample hidden state',(await counters()).samples-before.samples,0);
  const quiet=await counters();await page.waitForTimeout(250);metric('hidden countdown has no native animation wakeups',(await counters()).wakeups-quiet.wakeups,0);metric('hidden countdown has no native animation samples',(await counters()).samples-quiet.samples,0);
  if(scenario==='parent')for(let i=0;i<16;i++)await page.locator('[data-parent]').click();metric('hidden parent updates never restart animation',(await counters()).active,0);
  const foreground=await counters();await page.locator('[data-show]').click();metric('foregrounding immediately samples countdown',await page.evaluate(n=>probe.afterVisibilitySamples>n,foreground.samples),true);metric('foreground owns exactly one animation',(await counters()).active,1);
  if(scenario==='cycles')for(let i=0;i<4;i++){await page.locator('[data-hide]').click();metric('each background transition stops countdown',(await counters()).active,0);await page.locator('[data-show]').click();metric('each return owns one countdown',(await counters()).active,1);}
  for(let i=0;i<4;i++)await page.locator('[data-show]').click();metric('duplicate foreground signals own one timer',(await counters()).active,1);metric('countdown cannot start before the server boundary',await page.locator('.race-gameplay .guess-board').count(),0);
  const generation=await counters();await page.evaluate(()=>probe.slots.forEach(callback=>callback()));metric('only the current timer generation may sample',(await counters()).samples-generation.samples,1);
  if(scenario==='retired'){await page.locator('[data-mount]').click();await page.locator('[data-retired]').waitFor();const retired=await counters(),calls=await page.evaluate(()=>probe.calls.length);await page.evaluate(()=>probe.slots.forEach(callback=>callback()));metric('retired countdown callbacks cannot sample',(await counters()).samples-retired.samples,0);metric('retired countdown callbacks cannot dispatch',await page.evaluate(n=>probe.calls.length===n,calls),true);}
  else{await page.locator('[data-hide]').click();await page.locator('[data-advance]').click();const reached=await counters();await page.locator('[data-show]').click();await page.locator('.race-gameplay .guess-board').waitFor();metric('foregrounding catches up after the authoritative start',await page.locator('.race-native-answer-input').count(),1);metric('completed countdown releases its timer',(await counters()).active,0);const complete=await counters(),polls=await page.evaluate(()=>probe.calls.filter(x=>x==='poll').length);await page.evaluate(()=>probe.slots.forEach(callback=>callback()));metric('finished countdown callbacks cannot sample',(await counters()).samples-complete.samples,0);metric('finished countdown callbacks cannot trigger extra reads',await page.evaluate(n=>probe.calls.filter(x=>x==='poll').length===n,polls),true);metric('clock catch-up sampled immediately',complete.samples>reached.samples,true);await page.locator('.race-native-answer-input').focus();await page.keyboard.type('te');metric('resumed visible clock retains authoritative elapsed time',await page.locator('.race-header-clock strong').textContent().then(async text=>{const m=text.match(/(\d+):(\d+)\.(\d+)/),shown=(Number(m[1])*60+Number(m[2]))*1000+Number(m[3])*100;return Math.abs(shown-await page.evaluate(()=>window.expectedElapsed()))<500;}),true);metric('foreground answer drafting remains playable',await page.locator('.guess-row button:not([disabled])').allTextContents().then(values=>values.map(v=>v.toLowerCase())),['t','e','','']);await page.locator('[data-mount]').click();await page.locator('[data-retired]').waitFor();}
  metric('retirement owns no countdown timer',(await counters()).active,0);metric('only explicit retirement sends leave',await page.evaluate(()=>probe.calls.filter(x=>x==='leave').length),1);metric('browser errors',await page.evaluate(()=>probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_COUNTDOWN_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live countdown clock ownership');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_COUNTDOWN_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
