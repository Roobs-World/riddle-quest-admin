import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.LIVE_WAKE_REACT_MODE??'development';assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.LIVE_WAKE_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-recovery-wakeups-2026-10-05',mode));
const baseline=process.env.LIVE_WAKE_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-recovery-wakeups-'));const observations=[];let browser,server;
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES,LiveRaceViewSchema} from '@riddle-quest/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URL(location.href).searchParams.get('scenario')??'online-poll';window.probe={requests:[],joins:[],errors:[],unhandled:[],releases:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
let visible=true;window.show=value=>{visible=value;document.dispatchEvent(new Event('visibilitychange'));};Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visible?'visible':'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>!visible});
function view(seat){const now=Date.now(),countdown=now<seat.start;return LiveRaceViewSchema.parse({ticketId:seat.id,phase:seat.left?'cancelled':countdown?'countdown':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player:{displayName:seat.owner,avatarUrl:null,bot:false,correctCount:seat.correct},opponent:{displayName:'Rival',avatarUrl:null,bot:false,correctCount:seat.rival},result:null,rewardCoins:0,run:seat.left?null:{runId:seat.id,role:'creator',status:countdown?'scheduled':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:Math.max(0,now-seat.start),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-seat.start),events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:countdown?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function adapter(owner){const seat={owner,id:(owner==='Alice'?'a':'b').repeat(64),start:Date.now()+(scenario==='countdown'?650:-1000),correct:0,rival:0,left:false};return {observe:(ticket,changed,connected)=>{window.signal=changed;connected(true);return()=>{};},join:async input=>{window.probe.joins.push({owner,at:performance.now(),...input});if(scenario==='countdown'&&!seat.joined){seat.joined=true;seat.start=Date.now()+1500;}return view(seat);},update:async input=>{window.probe.requests.push({owner,at:performance.now(),...input});if(input.action==='leave')seat.left=true;if(input.action==='guess'){if(input.guess!=='piano')throw new Error('Unexpected fixture guess');seat.correct++;}const value=view(seat);if(input.action===(scenario.endsWith('-command')?'guess':'poll')&&window.holdPoll){window.holdPoll=false;return new Promise((resolve,reject)=>{window.release=()=>{window.probe.releases.push(performance.now());resolve(value);};window.reject=()=>{window.probe.releases.push(performance.now());reject(new Error('Fixture held transport failed'));};});}return value;},bump:()=>{seat.rival=3;}};}
const adapters={Alice:adapter('Alice'),Bob:adapter('Bob')};
window.recover=()=>{adapters.Alice.bump();if(scenario==='retired')flushSync(()=>window.retire());if(scenario==='replace')flushSync(()=>window.replace());const wake=()=>{if(scenario.startsWith('visible')){window.show(false);window.show(true);}else if(scenario==='push')window.signal();else if(scenario==='hidden')window.show(false);else if(!['countdown','backoff-delayed'].includes(scenario))window.dispatchEvent(new Event('online'));};for(let i=0;i<(scenario==='storm'?20:1);i++)wake();if(scenario==='backoff')window.reject();else if(scenario!=='backoff-delayed')window.release?.();};
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('Alice');window.retire=()=>setMounted(false);window.replace=()=>setOwner('Bob');return <div data-owner={owner}>{mounted?<LiveRaceGame key={owner} transport={adapters[owner]} locale='en' categoryId='mixed' coins={100} ownerId={owner} onClose={()=>setMounted(false)}/>:<p data-retired>Race removed</p>}<button data-arm onClick={()=>{window.holdPoll=true;window.signal();}}>Hold background read</button><button data-recover onClick={()=>window.recover()}>Recover pending read</button></div>;}
window.root=createRoot(document.querySelector('#root'));window.root.render(<React.StrictMode><App/></React.StrictMode>);
`);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-wake-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/race/LiveRaceGame.tsx'))return readFile(path.join(baseline,'live.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_WAKE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_WAKE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_WAKE_SCENARIOS?.split(',')??['online-poll','visible-poll','online-command','visible-command','storm','countdown','push','hidden','retired','replace','idle-online','idle-visible','backoff','backoff-delayed']) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.waitForFunction(()=>Boolean(window.signal));
  if(scenario.startsWith('idle')){
   await page.evaluate(scenario=>{if(scenario==='idle-online')window.dispatchEvent(new Event('online'));else{window.show(false);window.show(true);}},scenario);await page.waitForTimeout(150);
   metric('idle recovery admits one immediate read',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length),1);
  } else {
   if(scenario.endsWith('-command')){
    await page.evaluate(()=>{window.holdPoll=true;});await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');
   }else await page.locator('[data-arm]').click();
   await page.waitForFunction(()=>Boolean(window.release));
   metric('one owned delivery is held before recovery',await page.evaluate(()=>window.probe.requests.filter(x=>x.action!=='leave').length),1);
   if(scenario==='countdown')await page.locator('.race-gameplay').waitFor();
   if(scenario==='backoff-delayed'){await page.evaluate(()=>window.reject());await page.waitForTimeout(100);await page.evaluate(()=>window.signal());}await page.locator('[data-recover]').click();await page.waitForTimeout(scenario.startsWith('backoff')?2350:150);
   if(['retired','replace'].includes(scenario)){
    metric('retired seat does not admit queued catch-up',await page.evaluate(()=>window.probe.requests.filter(x=>x.owner==='Alice'&&x.action==='poll').length),1);
    metric('retired seat retains one leave authority key',await page.evaluate(()=>new Set(window.probe.requests.filter(x=>x.owner==='Alice'&&x.action==='leave').map(x=>x.requestId)).size),1);
    metric('retired UI remains removed or replaced',await page.locator(scenario==='replace'?'[data-owner="Bob"] .race-native-answer-input':'[data-retired]').count(),1);
   }else{
    const expectedPolls=scenario==='hidden'||scenario.endsWith('-command')?1:2;
    /* Slow runners may need longer than the 150 ms settle to deliver the catch-up; extra time can only expose extra reads. */
    await page.waitForFunction(n=>window.probe.requests.filter(x=>x.action==='poll').length>=n,expectedPolls,{timeout:3000}).catch(()=>undefined);await page.waitForTimeout(150);
    metric('queued recovery admits exactly one prompt catch-up read',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length),expectedPolls);
    metric('catch-up shows current rival progress',await page.locator('.race-progress > div:last-child strong').textContent(),scenario==='hidden'?'Riddles completed: 0 / 10':'Riddles completed: 3 / 10');
    if(scenario.endsWith('-command')){
     metric('native guess advances once before read-only reconciliation',await page.locator('.race-progress > div:first-child strong').textContent(),'Riddles completed: 1 / 10');
     metric('recovery does not replay a successful player command',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='guess').length),1);
    }
    if(scenario==='countdown')metric('server start releases the first playable prompt promptly',await page.locator('.race-native-answer-input').count(),1);
    if(scenario.startsWith('backoff'))metric('queued recovery retries after outage backoff and before the healthy watchdog',await page.evaluate(()=>{const polls=window.probe.requests.filter(x=>x.action==='poll');return polls.length===2&&polls[1].at-window.probe.releases[0]>=1900&&polls[1].at-window.probe.releases[0]<2300;}),true);
   }
   observations.push({width,height,scenario,diagnostic:true,name:'owned delivery and recovery trace',actual:await page.evaluate(()=>({requests:window.probe.requests,releases:window.probe.releases})),expected:null});
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external provider traffic',external,[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_WAKE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>!x.diagnostic&&JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.filter(x=>!x.diagnostic).length,samples:observations.filter(x=>x.diagnostic).length,failures},null,2));if(process.env.LIVE_WAKE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live wakeups survive owned in-flight deliveries');
