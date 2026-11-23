import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.READY_COMMIT_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.READY_COMMIT_BASELINE_DIR;
const output=path.resolve(process.env.READY_COMMIT_REPORT_DIR??path.join(root,'builds/test-evidence/game-ready-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/ready-commit-'));
const component=path.join(root,"src/platform/bridge/browser/useGameBridgeLifecycle.ts");
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameReadyReporter} from ${JSON.stringify(component)};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
const scenario=new URL(location.href).searchParams.get('scenario')??'speculative';
window.probe={ready:[],messages:[],intervals:new Map(),retained:[],observers:[],suspended:0,errors:[],unhandled:[],width:window.innerWidth};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));
window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
// Hold interval callbacks for exact commit-boundary delivery; the immediate timer remains native.
const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window),NativeObserver=window.ResizeObserver;
window.setInterval=(callback,delay,...args)=>{if(delay!==750)return interval(callback,delay,...args);const id=interval(()=>{},delay);window.probe.intervals.set(id,callback);window.probe.retained.push(callback);return id;};
window.clearInterval=id=>{window.probe.intervals.delete(id);clear(id);};
window.ResizeObserver=class {constructor(callback){this.callback=callback;this.disconnected=false;this.native=new NativeObserver(callback);window.probe.observers.push(this);}observe(element){this.native.observe(element);}disconnect(){this.disconnected=true;this.native.disconnect();}};
// A controlled dimension change makes old callbacks observable despite size deduplication.
Object.defineProperty(document.documentElement,'clientWidth',{configurable:true,get:()=>window.probe.width});
window.capture=()=>{window.savedReady=[...window.probe.intervals.values()];window.savedResize=window.probe.observers.filter(x=>!x.disconnected).map(x=>x.callback);window.probe.ready=[];window.probe.messages=[];};
window.deliverSaved=()=>{window.probe.width++;for(const callback of window.savedReady)callback();for(const callback of window.savedResize)callback([]);};
function Game({version,initialized}){const ready=React.useCallback(()=>window.probe.ready.push(version),[version]),post=React.useCallback(message=>window.probe.messages.push({version,message}),[version]);useGameReadyReporter({initialized,sendReady:ready,postToHost:post});return <output data-game data-version={version} data-initialized={String(initialized)}>Game {version}: {initialized?'ready':'waiting'}</output>;}
let unblock;const pending=new Promise(resolve=>unblock=resolve);function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.suspended++;throw pending;}return null;}
function App(){const [version,setVersion]=React.useState('A'),[mounted,setMounted]=React.useState(true),[initialized,setInitialized]=React.useState(false),[epoch,setEpoch]=React.useState(0);
window.speculate=()=>React.startTransition(()=>setVersion('B'));window.commit=()=>{window.allowB=true;unblock();setVersion('B');};window.initialize=()=>setInitialized(true);window.refresh=()=>setEpoch(x=>x+1);window.remount=()=>setMounted(true);
React.useLayoutEffect(()=>{if(!mounted||version==='B'||initialized){window.probe.phase={removed:!document.querySelector('[data-game]'),intervals:window.probe.intervals.size,observers:window.probe.observers.filter(x=>!x.disconnected).length};window.deliverSaved();}},[mounted,version,initialized]);
return <div data-epoch={epoch}><React.Suspense fallback={<p>Waiting</p>}>{mounted?<Game version={version} initialized={initialized||(scenario==='speculative'&&version==='B')}/>:<p data-retired>Retired game</p>}<Suspend version={version}/></React.Suspense><button data-retire onClick={()=>setMounted(false)}>Retire game</button><button data-replace onClick={()=>window.commit()}>Replace sender</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'ready-commit-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(path.join(baseline,'bridge.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.READY_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.READY_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.READY_COMMIT_SCENARIOS?.split(',')??['speculative','retire','replace','initialized','live','stable','remount']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.waitForFunction(()=>window.probe?.ready.length>0&&window.probe?.observers.some(x=>!x.disconnected));await page.evaluate(()=>window.capture());
  metric('one committed retry interval and resize observer',await page.evaluate(()=>({intervals:window.probe.intervals.size,observers:window.probe.observers.filter(x=>!x.disconnected).length})),{intervals:1,observers:1});
  if(scenario==='speculative'){await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.suspended>0);metric('suspended initialization keeps the waiting game visible',await page.locator('[data-game]').getAttribute('data-initialized'),'false');await page.evaluate(()=>window.deliverSaved());}
  else if(scenario==='retire'||scenario==='remount'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  else if(scenario==='replace'){await page.locator('[data-replace]').click();await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.version==='B');}
  else if(scenario==='initialized'){await page.evaluate(()=>window.initialize());await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.initialized==='true');}
  else{if(scenario==='stable'){const before=await page.evaluate(()=>({callbacks:window.probe.retained.length,observers:window.probe.observers.length}));for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}metric('ordinary parent updates keep the same timer and observer',await page.evaluate(()=>({callbacks:window.probe.retained.length,observers:window.probe.observers.length})),before);}await page.evaluate(()=>window.deliverSaved());}
  await page.waitForTimeout(60);
  metric('only committed waiting sender reports readiness',await page.evaluate(()=>window.probe.ready),scenario==='replace'?['B']:['retire','remount','initialized'].includes(scenario)?[]:['A']);
  metric('only current resize sender reports changed dimensions',await page.evaluate(()=>window.probe.messages.map(x=>x.version)),['retire','remount'].includes(scenario)?[]:[scenario==='replace'?'B':'A']);
  if(scenario==='retire'||scenario==='remount'){metric('queued callbacks are delivered after game DOM removal',await page.evaluate(()=>window.probe.phase.removed),true);metric('passive cleanup releases removed timer and observer',await page.evaluate(()=>({intervals:window.probe.intervals.size,observers:window.probe.observers.filter(x=>!x.disconnected).length})),{intervals:0,observers:0});const before=await page.evaluate(()=>({ready:window.probe.ready,messages:window.probe.messages}));await page.evaluate(()=>window.deliverSaved());metric('retained callbacks stay inactive after passive cleanup',await page.evaluate(()=>({ready:window.probe.ready,messages:window.probe.messages})),before);}
  if(scenario==='remount'){await page.evaluate(()=>{window.probe.ready=[];window.probe.messages=[];window.remount();});await page.waitForFunction(()=>window.probe.ready.length===1&&window.probe.observers.some(x=>!x.disconnected));await page.evaluate(()=>window.deliverSaved());metric('remount owns one new readiness report',await page.evaluate(()=>window.probe.ready),['A']);metric('remount keeps old callbacks retired',await page.evaluate(()=>window.probe.messages.map(x=>x.version)),['A']);}
  if(scenario==='initialized')metric('committed initialization stops readiness timers',await page.evaluate(()=>window.probe.intervals.size),0);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.READY_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.READY_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Readiness callbacks follow committed game ownership');
