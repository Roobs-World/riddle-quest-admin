import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.LIVE_SCHEDULE_REACT_MODE??'development',baseline=process.env.LIVE_SCHEDULE_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.LIVE_SCHEDULE_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-poll-scheduling-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-poll-scheduling-'));let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES,LiveRaceViewSchema} from '@riddle-quest/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URL(location.href).searchParams.get('scenario')??'healthy';window.probe={requests:[],joins:[],ticks:[],tickDetails:[],timers:new Map(),triggered:false,errors:[],unhandled:[]};
const nativeClear=window.clearTimeout.bind(window);window.clearTimeout=id=>{window.probe.timers.delete(id);return nativeClear(id);};
window.pollTimeout=(owner,callback,delay)=>{const id=window.setTimeout(()=>{window.probe.timers.delete(id);window.probe.ticks.push(owner);window.probe.tickDetails.push({owner,at:performance.now(),delay});callback();},delay);window.probe.timers.set(id,{owner,delay});return id;};
window.pendingPolls=owner=>[...window.probe.timers.values()].filter(x=>x.owner===owner).length;
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
function view(seat){const now=Date.now();return LiveRaceViewSchema.parse({ticketId:seat.id,phase:seat.left?'cancelled':seat.terminal?'result':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player:{displayName:seat.owner,avatarUrl:null,bot:false,correctCount:seat.correct},opponent:{displayName:'Rival',avatarUrl:null,bot:false,correctCount:0},result:seat.terminal?'win':null,rewardCoins:seat.terminal?50:0,run:seat.left?null:{runId:seat.id,role:'creator',status:seat.terminal?'completed':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:seat.terminal?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function adapter(owner){const seat={owner,id:(owner==='Alice'?'a':'b').repeat(64),start:Date.now()-1000,correct:0,left:false,terminal:false,failed:false};window.finish=()=>{seat.terminal=true;seat.correct=10;};return {observe:(ticket,changed,connected)=>{window.signal=changed;window.connection=connected;connected(true);if(scenario==='subscription-throw')throw new Error('Fixture subscription failed after connected');return()=>{};},join:async input=>{window.probe.joins.push({owner,at:performance.now(),...input});return view(seat);},update:async input=>{window.probe.requests.push({owner,at:performance.now(),...input});if(input.action==='poll'&&owner==='Alice'&&window.armed&&scenario!=='stable'){window.armed=false;window.probe.triggered=true;flushSync(()=>scenario==='replace'?window.replace():window.retire());}if(input.action==='leave')seat.left=true;if(input.action==='guess'){if(scenario==='backoff'&&!seat.failed){seat.failed=true;throw new Error('Fixture command transport failed');}if(input.guess!=='piano')throw new Error('Unexpected fixture guess');seat.correct++;if(scenario==='held')return new Promise(resolve=>{window.releaseGuess=()=>resolve(view(seat));});}return view(seat);}};}
const bob=adapter('Bob'),alice=adapter('Alice');const adapters={Alice:alice,Bob:bob};
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('Alice');window.retire=()=>setMounted(false);window.replace=()=>setOwner('Bob');return <div data-owner={owner}>{mounted?<LiveRaceGame key={owner} transport={adapters[owner]} locale='en' categoryId='mixed' coins={100} ownerId={owner} onClose={()=>setMounted(false)}/>:<p data-retired>Race removed</p>}<button data-arm onClick={()=>{window.armed=true;}}>Arm transport retirement</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-owned-native-poll',enforce:'pre',async load(id){if(baseline&&id.endsWith('/hooks/useLiveRaceSignals.ts'))return readFile(path.join(baseline,'signals.before.txt'),'utf8');if(!id.endsWith('/LiveRaceGame.tsx'))return;let source=await readFile(baseline?path.join(baseline,'live.before.txt'):id,'utf8');const needle='timer = window.setTimeout(() => {';assert.equal(source.split(needle).length,2);return source.replace(needle,'timer = window.pollTimeout(ownerId, () => {');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_SCHEDULE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_SCHEDULE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_SCHEDULE_SCENARIOS?.split(',')??['healthy','disconnected','hidden','held','backoff','watchdog','retire','replace','subscription-throw','terminal']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});await page.goto(url+'/?scenario='+scenario);await page.locator('.race-native-answer-input').waitFor();await page.waitForFunction(()=>window.pendingPolls('Alice')===1);
  const before=await page.evaluate(()=>window.probe.ticks.length);await page.waitForTimeout(1150);const sampled=await page.evaluate(before=>window.probe.ticks.length-before,before);
  observations.push({width,height,scenario,diagnostic:true,name:'native polling callbacks while push is healthy',actual:sampled,expected:null});
  if(scenario!=='subscription-throw'){
   metric('healthy push avoids unnecessary half-second polling wakeups',sampled<=1,true);
   metric('healthy push has no premature provider polls',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length),0);
  }
  metric('current seat retains one bounded observation timer',await page.evaluate(()=>window.pendingPolls('Alice')),1);
  if(scenario==='disconnected'||scenario==='subscription-throw'){
   if(scenario==='disconnected')await page.evaluate(()=>window.connection(false));await page.waitForTimeout(650);
   metric('disconnected or failed subscriptions retain fast provider fallback',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length>=2),true);
  } else if(scenario==='hidden'){
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.hiddenFixture?'hidden':'visible'});window.hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'));});const polls=await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length);
   await page.waitForTimeout(1150);metric('hidden state catches up once and retains one-second provider cadence',await page.evaluate(polls=>{const reads=window.probe.requests.filter(x=>x.action==='poll').slice(polls);return reads.length>=1&&reads.length<=2&&(reads.length<2||reads[1].at-reads[0].at>=999);},polls),true);
   const hiddenPolls=await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='poll').length);await page.evaluate(()=>{window.hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(30);metric('visible recovery immediately observes the current match',await page.evaluate(polls=>window.probe.requests.filter(x=>x.action==='poll').length-polls,hiddenPolls),1);
  } else if(scenario==='watchdog'){
   await page.waitForFunction(()=>window.probe.requests.some(x=>x.action==='poll'),null,{timeout:6000});metric('healthy watchdog has at most one fractional-timer tail',await page.evaluate(before=>window.probe.ticks.length-before<=2,before),true);metric('watchdog tail never adds a half-second provider delay',await page.evaluate(()=>window.probe.requests.find(x=>x.action==='poll').at-window.probe.joins.at(-1).at<5150),true);observations.push({width,height,scenario,diagnostic:true,name:'watchdog native timer trace',actual:await page.evaluate(()=>window.probe.tickDetails),expected:null});
  } else if(['retire','replace'].includes(scenario)){
   await page.locator('[data-arm]').click();await page.evaluate(()=>window.signal());await page.waitForFunction(()=>window.probe.triggered);
   if(scenario==='replace')await page.waitForFunction(()=>window.probe.joins.some(x=>x.owner==='Bob'));
   metric('reentrant retirement releases the original scheduler',await page.evaluate(()=>window.pendingPolls('Alice')),0);
   const retired=await page.evaluate(()=>window.probe.ticks.filter(x=>x==='Alice').length);await page.waitForTimeout(650);metric('retired polling callbacks remain stopped',await page.evaluate(before=>window.probe.ticks.filter(x=>x==='Alice').length-before,retired),0);
   metric('retired leave deliveries retain one idempotency key',await page.evaluate(()=>new Set(window.probe.requests.filter(x=>x.owner==='Alice'&&x.action==='leave').map(x=>x.requestId)).size),1);
   if(scenario==='replace')metric('replacement seat owns one independent scheduler',await page.evaluate(()=>window.pendingPolls('Bob')),1);
  } else if(scenario==='terminal'){
   await page.evaluate(()=>{window.finish();window.signal();});await page.waitForTimeout(30);metric('terminal receipt immediately stops polling',await page.evaluate(()=>window.pendingPolls('Alice')),0);
  } else {
   await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');
   if(scenario==='held'){
    await page.waitForFunction(()=>Boolean(window.releaseGuess));const held=await page.evaluate(()=>window.probe.ticks.length);await page.waitForTimeout(650);metric('owned held commands do not leave idle observation timers',await page.evaluate(()=>window.pendingPolls('Alice')),0);metric('held command produces no idle scheduler wakeups',await page.evaluate(before=>window.probe.ticks.length-before,held),0);await page.evaluate(()=>window.releaseGuess());
   }
   if(scenario==='backoff'){
    await page.waitForFunction(()=>window.probe.requests.filter(x=>x.action==='guess').length>=2,null,{timeout:6500});metric('retained command retries on backoff without waiting for the push watchdog',await page.evaluate(()=>{const guesses=window.probe.requests.filter(x=>x.action==='guess');return guesses[1].at-guesses[0].at<2800;}),true);metric('retry preserves its original authority receipt',await page.evaluate(()=>new Set(window.probe.requests.filter(x=>x.action==='guess').map(x=>x.requestId)).size),1);
   }
   await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('native answer advances through the owned transport',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='guess').length),scenario==='backoff'?2:1);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external provider traffic',external,[]);await context.close();

 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_SCHEDULE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>!x.diagnostic&&JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.filter(x=>!x.diagnostic).length,samples:observations.filter(x=>x.diagnostic).length,failures},null,2));if(process.env.LIVE_SCHEDULE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live race polling scheduling');
