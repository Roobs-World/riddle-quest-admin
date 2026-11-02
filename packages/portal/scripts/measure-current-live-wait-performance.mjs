import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {RACE_RULES,LiveRaceViewSchema}=require('@riddle-quest/core/race');
const output=path.resolve(process.env.LIVE_WAIT_PERFORMANCE_REPORT_DIR??path.join(root,'../../artifacts/performance-current-20261019/client'));
await mkdir(output,{recursive:true});
const baseline=await readFile(path.join(output,'liveRacePolling.before.ts'),'utf8');
const candidate=baseline.replace('Partial<Pick<LiveRaceView, "run">>)','Partial<Pick<LiveRaceView, "run" | "waitForPlayer" | "challengeId">>)').replace('  if (!visible || view?.phase', '  if (visible && pushConnected && view?.phase === "searching" && (view.waitForPlayer || view.challengeId)) return 4_000;\n  if (!visible || view?.phase');
assert.notEqual(candidate,baseline);
assert.equal(await readFile(path.join(root,'src/play/race/logic/liveRacePolling.ts'),'utf8'),candidate,'The candidate must match the current production source');
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-wait-perf-'));
let server,browser;
const matches=new Map();
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
const p=new URLSearchParams(location.search);window.__stats={requests:[],storage:{get:0,set:0,remove:0,ms:0},longtasks:[],renders:0,signalAt:null,signalPaintMs:null};
for(const [method,count] of [['getItem','get'],['setItem','set'],['removeItem','remove']]){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{window.__stats.storage[count]++;window.__stats.storage.ms+=performance.now()-start;}};}
try{new PerformanceObserver(list=>window.__stats.longtasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
const call=async(input)=>{const start=performance.now();const response=await fetch('/live?session='+p.get('session')+'&mode='+p.get('mode'),{method:'POST',body:JSON.stringify(input)});if(!response.ok)throw Error('Failed fixture transport');const view=await response.json();window.__stats.requests.push({action:input.action||'join',start,ms:performance.now()-start});return view;};
const transport={join:input=>call(input),update:input=>call(input),observe:(ticketId,onChange,onStatus)=>{window.__notify=onChange;window.__status=onStatus;queueMicrotask(()=>onStatus(p.get('push')!=='0'));return()=>{};}};
window.__beginMatch=async()=>{await fetch('/match?session='+p.get('session'),{method:'POST'});window.__stats.signalAt=performance.now();window.__notify();};
new MutationObserver(()=>{if(window.__stats.signalAt!==null&&window.__stats.signalPaintMs===null&&document.querySelector('.live-race-search-wheel[data-phase="countdown"]')){requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__stats.signalPaintMs=performance.now()-window.__stats.signalAt;}));}}).observe(document.getElementById('root'),{childList:true,subtree:true,attributes:true});
createRoot(document.getElementById('root')).render(<LiveRaceGame transport={transport} locale='en' categoryId='history' ownerId={'Performance-'+p.get('session')} coins={100} createChallenge={p.get('mode')==='private'} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>1,onCommitFiberRoot:()=>{if(window.__stats)window.__stats.renders++;},onCommitFiberUnmount:()=>{}};</script></head><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
const samples=[];
try{
  for(const variant of ['baseline','candidate'])await build({root:scratch,base:'/'+variant+'/',configFile:false,logLevel:'error',publicDir:path.join(root,'public'),plugins:[{name:'measure-current-live-wait',enforce:'pre',transform(code,id){if(id.endsWith('/logic/liveRacePolling.ts'))return variant==='baseline'?baseline:candidate;}},react(),babel({presets:[reactCompilerPreset()]})],build:{outDir:variant}});
  server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/match'){const current=matches.get(url.searchParams.get('session'));assert.ok(current);current.startsAt=Date.now()+5000;res.end('{}');return;}
    if(url.pathname==='/live'){
      let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body),session=url.searchParams.get('session'),mode=url.searchParams.get('mode');
      if(!matches.has(session))matches.set(session,{created:Date.now(),startsAt:null});const current=matches.get(session),now=Date.now();
      const phase=current.startsAt===null?'searching':now<current.startsAt?'countdown':'racing';
      const player={displayName:'Alice',avatarUrl:null,bot:false,correctCount:0},opponent=current.startsAt?{displayName:'Bob',avatarUrl:null,bot:false,correctCount:0}:null;
      const view=LiveRaceViewSchema.parse({ticketId:'a'.repeat(64),phase,serverNowMs:now,searchEndsAtMs:current.created+(mode==='legacy'?6000:900000),startsAtMs:current.startsAt,player,opponent,run:current.startsAt?{runId:'a'.repeat(64),role:'creator',status:phase==='countdown'?'scheduled':'active',serverNowMs:now,startsAtMs:current.startsAt,categoryId:'history',locale:'en',rules:RACE_RULES,correctCount:0,wallElapsedMs:Math.max(0,now-current.startsAt),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-current.startsAt),events:[],currentRiddle:phase==='countdown'?null:{riddleId:'question',text:'An answer for profiling',answerLength:4,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}:null,result:null,rewardCoins:0,...(mode==='public'?{waitForPlayer:true}:mode==='private'?{challengeId:'live_'+'b'.repeat(64)}:{})});
      await new Promise(resolve=>setTimeout(resolve,20));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(view));return;
    }
    const [,variant,...segments]=url.pathname.split('/'),file=path.join(scratch,variant,segments.join('/')||'index.html');
    const body=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);
  }catch(error){console.error(error);res.writeHead(500).end(String(error));}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  const execute=async({variant,mode='public',push=true,duration=13000,profile=false,index})=>{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
    const session=crypto.randomUUID();await page.goto('http://127.0.0.1:'+server.address().port+'/'+variant+'/?session='+session+'&mode='+mode+'&push='+(push?'1':'0'));
    await page.locator('.live-race-self strong,.friend-lobby-seat strong').first().waitFor();await page.evaluate(async()=>{await document.fonts.ready;});await page.waitForTimeout(150);
    if(profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    const before=await page.evaluate(()=>({...structuredClone(window.__stats),now:performance.now()}));assert.ok(before.renders>0,'Commit observer must observe real React work');const metricsBefore=(await cdp.send('Performance.getMetrics')).metrics;
    await page.waitForTimeout(duration);
    const after=await page.evaluate(()=>structuredClone(window.__stats));const metricsAfter=(await cdp.send('Performance.getMetrics')).metrics;
    if(profile){const {profile:cpu}=await cdp.send('Profiler.stop');await writeFile(path.join(output,variant+'-pilot.cpuprofile'),JSON.stringify(cpu));}
    const metric=name=>metricsAfter.find(m=>m.name===name).value-metricsBefore.find(m=>m.name===name).value;
    const idle={durationMs:duration,polls:after.requests.filter(r=>r.action==='poll').length-before.requests.filter(r=>r.action==='poll').length,renders:after.renders-before.renders,storage:Object.fromEntries(Object.keys(after.storage).map(key=>[key,after.storage[key]-before.storage[key]])),longtasks:after.longtasks.filter(task=>task.start>=before.now),taskMs:metric('TaskDuration')*1000,scriptMs:metric('ScriptDuration')*1000,layoutMs:metric('LayoutDuration')*1000,layoutCount:metric('LayoutCount'),styleRecalcCount:metric('RecalcStyleCount'),requestMs:after.requests.slice(before.requests.length).map(r=>r.ms)};
    if(index===0)await page.screenshot({path:path.join(output,variant+'-'+mode+'-'+(push?'push':'fallback')+'-waiting-390.png')});
    if(push){await page.evaluate(()=>window.__beginMatch());await page.waitForFunction(()=>window.__stats.signalPaintMs!==null);assert.equal(await page.locator('.live-race-rival strong,.friend-lobby-seat strong').last().innerText(),'Bob');}
    const signalPaintMs=await page.evaluate(()=>window.__stats.signalPaintMs);
    if(index===0){await page.screenshot({path:path.join(output,variant+'-'+mode+'-390.png')});}
    assert.deepEqual(errors,[]);assert.ok(!push||signalPaintMs<1000,'Healthy push delivers promptly');
    const sample={variant,mode,push,index,profile,idle,signalPaintMs,errors};samples.push(sample);console.log(JSON.stringify(sample));await context.close();
  };
  // CPU profiles identify the limiter and are excluded from the reported samples.
  if(process.env.LIVE_WAIT_PERFORMANCE_SMOKE==='1')for(const mode of ['public','private'])for(const variant of ['baseline','candidate'])await execute({variant,mode,duration:100,index:0});
  else{
    for(const variant of ['baseline','candidate'])await execute({variant,duration:4500,profile:true,index:-1});
    for(let index=0;index<5;index++)for(const variant of ['baseline','candidate'])await execute({variant,index});
    for(const mode of ['private','legacy'])for(const variant of ['baseline','candidate'])await execute({variant,mode,duration:4500,index:0});
    for(const variant of ['baseline','candidate'])await execute({variant,push:false,duration:4500,index:0});
  }
  const summarize=variant=>{
    const selected=samples.filter(s=>s.variant===variant&&s.mode==='public'&&s.push&&!s.profile);
    const stats=key=>{const values=selected.map(key).sort((a,b)=>a-b);return{median:values[2],min:values[0],max:values.at(-1),values};};
    return{variant,runs:selected.length,polls:stats(s=>s.idle.polls),renders:stats(s=>s.idle.renders),taskMs:stats(s=>s.idle.taskMs),storageReads:stats(s=>s.idle.storage.get),storageWrites:stats(s=>s.idle.storage.set),signalPaintMs:stats(s=>s.signalPaintMs)};
  };
  await writeFile(path.join(output,process.env.LIVE_WAIT_PERFORMANCE_SMOKE==='1'?'smoke-results.json':'results.json'),JSON.stringify({conditions:{releaseBuild:true,reactCompiler:true,node:process.version,chromium:browser.version(),react:require('react/package.json').version,vite:require('vite/package.json').version,smokeOnly:process.env.LIVE_WAIT_PERFORMANCE_SMOKE==='1',viewport:{width:390,height:844},cpuThrottlingRate:4,httpFixtureDelayMs:20,scope:'Actual LiveRaceGame release build, local HTTP fixture transport. Isolates client costs; not hosted Jest, Firestore or SMS latency.',renderMeasurement:'React commit hook, without instrumenting or changing the compiled component source',signalPaintMeasurement:'Two requestAnimationFrame callbacks after the countdown DOM commit; not a hardware display latency measurement',baselineSha256:crypto.createHash('sha256').update(baseline).digest('hex'),candidateSha256:crypto.createHash('sha256').update(candidate).digest('hex'),runOrder:process.env.LIVE_WAIT_PERFORMANCE_SMOKE==='1'?'four short style and schema smoke checks':'baseline,candidate alternated5times; profiling pilots excluded'},summaries:process.env.LIVE_WAIT_PERFORMANCE_SMOKE==='1'?[]:['baseline','candidate'].map(summarize),samples},null,2)+'\n');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
