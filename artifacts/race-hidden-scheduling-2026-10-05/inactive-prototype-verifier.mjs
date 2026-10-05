import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.RACE_HIDDEN_REACT_MODE??'production';assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.RACE_HIDDEN_REPORT_DIR??path.join(root,'../../artifacts/race-hidden-scheduling-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-hidden-scheduling-'));const observations=[];let browser,server;
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
import {useRaceSession} from ${JSON.stringify(path.join(root,'src/play/race/hooks/useRaceSession.ts'))};
const scenario=new URL(location.href).searchParams.get('scenario')??'idle';const authority=createFakeRaceServices();const prepared=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'fixture',prepare:true,includeEvaluation:true})).run;
const originalNow=performance.now.bind(performance);let offset=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>originalNow()+offset});window.jump=elapsed=>{offset+=elapsed;};
const deadlines=new Map(),nativeTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window);window.setTimeout=(callback,delay,...args)=>{const id=nativeTimeout(callback,delay,...args);if(delay===30000)deadlines.set(id,()=>callback(...args));return id;};window.clearTimeout=id=>{deadlines.delete(id);nativeClearTimeout(id);};window.expire=()=>{for(const [id,callback] of deadlines){window.clearTimeout(id);callback();}};window.deadlines=()=>deadlines.size;
const intervals=new Map();const set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);let starts=0,ticks=0;
window.setInterval=(callback,delay,...args)=>{const id=set(()=>{ticks++;callback(...args);},delay);intervals.set(id,delay);starts++;return id;};window.clearInterval=id=>{intervals.delete(id);clear(id);};
window.resources=()=>({delays:[...intervals.values()],ticks,starts});
let visible=new URL(location.href).searchParams.get('initial')!=='hidden';if(new URL(location.href).searchParams.get('native')!=='1')Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visible?'visible':'hidden'});window.show=value=>{visible=value;document.dispatchEvent(new Event('visibilitychange'));};
window.probe={errors:[],unhandled:[],commands:[]};window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const reply=(message,operation,data)=>window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));
function postToHost(message){window.probe.commands.push(message);if(scenario==='deadline')return;
 if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});
 if(message.type==='game:startRace')reply(message,'raceStart',{run:prepared});
 if(message.type==='game:readyRace'){const now=Date.now();window.startAt=now+3000;reply(message,'raceReady',{run:{...prepared,status:'scheduled',serverNowMs:now,startsAtMs:window.startAt}});}
 if(message.type==='game:getRaceEntry')reply(message,'raceEntry',{status:'waiting',invitation:{claimState:'claimed',publicationState:'pending',role:'recipient',canCancel:false,expiresAtMs:Date.now()+60000},serverNowMs:Date.now()});
}
function App(){const [owner,setOwner]=React.useState('owner-1');const {session,state}=useRaceSession({ownerId:owner,locale:'en',...(scenario==='waiting'?{challengeId:'invitation'}:{})},{postToHost});window.session=session;window.state=state;window.replaceOwner=()=>setOwner('owner-2');return <><button onClick={()=>session.begin('mixed')}>Start</button><button onClick={()=>window.show(false)}>Hide</button><button onClick={()=>window.show(true)}>Show</button><output data-stage={state.stage} data-error={state.error??''}>{state.stage}</output></>;}
window.root=createRoot(document.querySelector('#root'));window.root.render(<React.StrictMode><App/></React.StrictMode>);
`);
 await build({root:scratch,configFile:false,publicDir:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'race-hidden-baseline',enforce:'pre',async load(id){if(process.env.RACE_HIDDEN_BASELINE_DIR&&id.endsWith('/race/hooks/useRaceSession.ts'))return readFile(path.join(process.env.RACE_HIDDEN_BASELINE_DIR,'hook.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_HIDDEN_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.RACE_HIDDEN_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const initial of process.env.RACE_HIDDEN_QUICK==='1'?['visible']:['visible','hidden'])for(const scenario of process.env.RACE_HIDDEN_SCENARIOS?.split(',')??(process.env.RACE_HIDDEN_QUICK==='1'?['idle']:['idle','countdown','racing','waiting','deadline'])) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({mode,width,height,initial,scenario,name,actual,expected});
  await page.goto(origin+'?initial='+initial+'&scenario='+scenario);await page.waitForFunction(scenario=>window.state&&(scenario==='deadline'?window.state.pending==='raceCategories':window.state.pending===null),scenario);
  metric('initial visibility selects exactly one interval',(await page.evaluate(()=>window.resources())).delays,[initial==='visible'?50:1000]);
  if(['countdown','racing'].includes(scenario)){
   await page.getByRole('button',{name:'Start',exact:true}).click();await page.waitForFunction(()=>window.state.run?.status==='scheduled');
   if(scenario==='racing')await page.evaluate(()=>{window.jump(4000);window.show(true);});
  }
  await page.getByRole('button',{name:'Hide',exact:true}).click();
  const before=await page.evaluate(()=>window.resources()),entries=await page.evaluate(()=>window.probe.commands.filter(x=>x.type==='game:getRaceEntry').length);
  await page.evaluate(()=>{window.show(false);window.show(false);});
  metric('repeated hidden events keep the selected interval',(await page.evaluate(()=>window.resources())).starts,before.starts);
  const sample=process.env.RACE_HIDDEN_QUICK==='1'?650:1150;await page.waitForTimeout(sample);const hidden=await page.evaluate(()=>window.resources());
  observations.push({mode,width,height,initial,scenario,diagnostic:true,name:'sampled hidden interval callbacks',actual:{sampleMs:sample,callbacks:hidden.ticks-before.ticks},expected:null});
  metric('hidden journey has one bounded housekeeping interval',hidden.delays,[1000]);metric('hidden journey avoids animation-frequency wakeups',hidden.ticks-before.ticks<=Math.ceil(sample/1000),true);
  if(sample>=1000)metric('hidden housekeeping continues on the owned native interval',hidden.ticks>before.ticks,true);
  if(scenario==='waiting')metric('hidden invitation never polls',await page.evaluate(()=>window.probe.commands.filter(x=>x.type==='game:getRaceEntry').length),entries);
  if(scenario==='deadline'){
   metric('pending command keeps its independent deadline',await page.evaluate(()=>window.deadlines()),1);await page.evaluate(()=>window.expire());
   metric('hidden delivery deadline still settles pending ownership',await page.evaluate(()=>({pending:window.state.pending,error:window.state.error})),{pending:null,error:'RaceTo10.ERROR_GENERIC'});
  }
  if(scenario==='countdown')await page.evaluate(()=>window.jump(4000));
  const visibleBefore=await page.evaluate(()=>window.resources());await page.getByRole('button',{name:'Show',exact:true}).click();
  metric('visible journey retains the established animation interval',(await page.evaluate(()=>window.resources())).delays,[50]);
  if(['countdown','racing'].includes(scenario)){
   metric('visible recovery immediately restores authoritative gameplay',await page.evaluate(()=>({stage:window.state.stage,start:window.state.run.startsAtMs===window.startAt,status:window.state.run.status})),{stage:'racing',start:true,status:'active'});
   metric('visible clock includes hidden monotonic elapsed time',await page.evaluate(()=>window.state.adjustedNow>=1000),true);
  }
  if(scenario==='waiting')metric('visible invitation recovery performs one immediate read',await page.evaluate(()=>window.probe.commands.filter(x=>x.type==='game:getRaceEntry').length),entries+1);
  await page.evaluate(()=>{window.show(true);window.show(true);});const resumed=await page.evaluate(()=>window.resources());metric('repeated visible events keep exactly one replacement interval',resumed.starts,visibleBefore.starts+1);
  await page.waitForTimeout(160);metric('visible animation callbacks resume',(await page.evaluate(()=>window.resources())).ticks>resumed.ticks,true);
  await page.evaluate(()=>window.replaceOwner());await page.waitForTimeout(30);metric('account replacement retains one visible scheduler',(await page.evaluate(()=>window.resources())).delays,[50]);
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external traffic',external,[]);
  await page.evaluate(()=>window.root.unmount());const retired=await page.evaluate(()=>window.resources());metric('unmount releases every interval',retired.delays,[]);metric('unmount cancels command deadlines',await page.evaluate(()=>window.deadlines()),0);
  await page.evaluate(()=>{window.show(false);window.show(true);});await page.waitForTimeout(60);metric('retired visibility events cannot recreate scheduling',await page.evaluate(()=>window.resources()),retired);await context.close();

 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_HIDDEN_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>!row.diagnostic&&JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.filter(row=>!row.diagnostic).length,samples:observations.filter(row=>row.diagnostic).length,failures},null,2));assert.equal(failures.length,0,'Hidden race scheduling stays bounded without losing visible recovery');
