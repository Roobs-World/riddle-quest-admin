import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.RACE_HIDDEN_REACT_MODE??'development',baseline=process.env.RACE_HIDDEN_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.RACE_HIDDEN_REPORT_DIR??path.join(root,'../../artifacts/race-hidden-clock-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-hidden-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
import {RACE_RULES,RaceRunResponseSchema} from '@qwordly/core/race';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={ticks:0,wakeups:0,slots:[],active:new Map(),commands:[],state:null,errors:[],unhandled:[],offset:0};
window.addEventListener('error',e=>probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>probe.unhandled.push(String(e.reason)));
let visible=!new URLSearchParams(location.search).has('hidden');Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visible?'visible':'hidden'});
const nativeNow=performance.now.bind(performance);performance.now=()=>nativeNow()+probe.offset;
const nativeInterval=window.setInterval.bind(window),nativeClear=window.clearInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{const id=nativeInterval(delay===50?()=>{probe.wakeups++;callback(...args);}:callback,delay,...args);if(delay===50){probe.slots.push(callback);probe.active.set(id,callback);}return id;};
window.clearInterval=id=>{probe.active.delete(id);nativeClear(id);};
const catalog=createFakeRaceServices(),deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const reply=(message,operation,data)=>window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));
function postToHost(message){probe.commands.push(message.type);if(message.type==='game:listRaceCategories')void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));if(message.type==='game:startRace'){const now=Date.now();reply(message,'raceStart',RaceRunResponseSchema.parse({run:{runId:'hidden-clock-run',role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,currentRiddle:prompt(0),preloadedRiddles:deck,events:[],serverNowMs:now,startsAtMs:now-1000}}));}}
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('fixture-a'),[tick,setTick]=React.useState(0);return <><nav style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white'}}><button data-hide onClick={()=>{visible=false;document.dispatchEvent(new Event('visibilitychange'));}}>Hide fixture</button><button data-show onClick={()=>{visible=true;document.dispatchEvent(new Event('visibilitychange'));}}>Show fixture</button><button data-advance onClick={()=>{probe.offset+=5000;}}>Advance clock</button><button data-parent onClick={()=>setTick(x=>x+1)}>Update parent</button><button data-owner onClick={()=>setOwner(x=>x==='fixture-a'?'fixture-b':'fixture-a')}>Switch player</button><button data-mount onClick={()=>setMounted(x=>!x)}>Mount or retire</button><span data-parent-count>{tick}</span></nav>{mounted?<RaceTo10Game locale='en' coins={100} ownerId={owner} postToHost={postToHost} onClose={()=>setMounted(false)}/>:<p data-retired>Retired fixture</p>}</>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'race-hidden-clock-probe',enforce:'pre',async load(id){if(baseline&&id.endsWith('/hooks/useRaceSession.ts'))return readFile(path.join(baseline,'hook.before.txt'),'utf8');if(id.endsWith('/race/RaceSession.ts')){const source=await readFile(id,'utf8');return source.replace('tick = (): void => {','tick = (): void => { window.probe.ticks++;').replace('getSnapshot = (): RaceSessionState => this.state;','getSnapshot = (): RaceSessionState => {window.probe.state=this.state;return this.state;};');}}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_HIDDEN_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.RACE_HIDDEN_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.RACE_HIDDEN_CASES?.split(',')??['lobby','hidden-mount','countdown','racing','parent','owner','retired']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const counters=()=>page.evaluate(()=>({ticks:probe.ticks,wakeups:probe.wakeups,active:probe.active.size}));
  await page.goto(url+(scenario==='hidden-mount'?'?hidden=1':''));await page.locator('.race-category-grid button').first().waitFor();await settle();
  metric('catalog settles through the real bridge',await page.evaluate(()=>probe.state.pending),null);
  metric('initial clock ownership matches visibility',(await counters()).active,scenario==='hidden-mount'?0:1);
  if(['countdown','racing','owner'].includes(scenario)){await page.locator('.race-category-grid button').first().click();await page.waitForFunction(()=>probe.state.stage==='countdown'&&probe.state.run!==null);if(scenario!=='countdown'){await page.locator('[data-advance]').click();await page.waitForFunction(()=>probe.state.stage==='racing');}}
  await page.locator('[data-hide]').click();await settle();const before=await counters(),elapsed=await page.evaluate(()=>probe.state.adjustedNow);
  metric('hidden adapter owns no periodic timer',before.active,0);
  const slots=await page.evaluate(()=>probe.slots.length);
  await page.evaluate(()=>probe.slots.at(-1)?.());
  metric('a queued clock callback cannot tick a hidden journey',(await counters()).ticks-before.ticks,0);
  const quiet=await counters();await page.waitForTimeout(180);
  metric('hidden journey receives no native periodic wakeups',(await counters()).wakeups-quiet.wakeups,0);
  metric('hidden journey receives no native periodic ticks',(await counters()).ticks-quiet.ticks,0);
  if(scenario==='parent')for(let i=0;i<16;i++)await page.locator('[data-parent]').click();
  if(scenario==='owner'){await page.locator('[data-owner]').click();await page.waitForFunction(()=>probe.state.stage==='categories'&&probe.state.pending===null);metric('account replacement discards the old race',await page.evaluate(()=>probe.state.run),null);}
  if(scenario==='retired'){await page.locator('[data-mount]').click();await page.locator('[data-retired]').waitFor();const retired=await counters();await page.evaluate(()=>probe.slots.at(-1)?.());metric('a retired queued callback cannot enter the session',(await counters()).ticks-retired.ticks,0);await page.locator('[data-mount]').click();await page.locator('.race-category-grid button').first().waitFor();}
  metric('hidden parent or entry changes allocate no clock',await page.evaluate(n=>probe.slots.length===n,slots),true);
  await page.locator('[data-advance]').click();const resume=await counters();await page.locator('[data-show]').click();
  metric('visibility recovery owns exactly one timer',(await counters()).active,1);
  metric('visibility recovery immediately ticks',await page.evaluate(n=>probe.ticks>n,resume.ticks),true);
  if(scenario==='countdown'){metric('a hidden countdown catches up on return',await page.evaluate(()=>probe.state.stage),'racing');}
  if(scenario==='racing')metric('elapsed time includes the hidden interval',await page.evaluate(n=>probe.state.adjustedNow>=n+5000,elapsed),true);
  for(let i=0;i<8;i++)await page.locator('[data-show]').click();metric('repeated visibility events never duplicate timers',(await counters()).active,1);
  await page.waitForFunction(n=>probe.wakeups>n,resume.wakeups);metric('native foreground clock callbacks resume',await page.evaluate(n=>probe.wakeups>n,resume.wakeups),true);
  await page.locator('[data-mount]').click();await page.locator('[data-retired]').waitFor();metric('unmount releases the clock',(await counters()).active,0);
  const done=await counters();await page.evaluate(()=>probe.slots.at(-1)?.());metric('late delivery after visible retirement is quiet',(await counters()).ticks-done.ticks,0);
  metric('browser errors',await page.evaluate(()=>probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.RACE_HIDDEN_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Hidden race clock ownership');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_HIDDEN_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
