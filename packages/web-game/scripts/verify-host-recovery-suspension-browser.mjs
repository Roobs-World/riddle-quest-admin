import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';
const portal=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.RECOVERY_SUSPENSION_MODE??'development',engine=process.env.RECOVERY_SUSPENSION_BROWSER??'chromium';
const output=path.resolve(process.env.RECOVERY_SUSPENSION_REPORT_DIR??path.join(portal,'../../builds/test-evidence/host-recovery-suspension-2026-10-08',engine+'-'+mode));
await mkdir(output,{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/recovery-suspension-'));
const observations=[];let browser,server,browserVersion;
try {
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostRiddleLifecycle} from ${JSON.stringify(path.join(portal,'src/play/useHostRiddleLifecycle.ts'))};
const scenario=new URLSearchParams(location.search).get('scenario'),initial=scenario.endsWith('abandoned-resume');
window.probe={reads:[],posts:[],recoveries:0,errors:[],unhandled:[],renders:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeSetTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window),timers=new Map();
window.setTimeout=(callback,delay,...args)=>{if(delay!==250)return nativeSetTimeout(callback,delay,...args);const id=nativeSetTimeout(()=>{timers.delete(id);callback(...args);},120000);timers.set(id,()=>callback(...args));return id;};window.clearTimeout=id=>{timers.delete(id);nativeClearTimeout(id);};window.fireRecovery=()=>{for(const [id,callback] of [...timers]){timers.delete(id);nativeClearTimeout(id);callback();}};window.timerCount=()=>timers.size;
const riddle={riddleId:'classic_2',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000002',gameMode:'classic',index:2};
const services={loadRiddle:async input=>{window.probe.reads.push(input);return riddle;}},postToGame=message=>window.probe.posts.push(message),postOperation=()=>{},setNotice=()=>{},withActivity=operation=>operation(),onRecoveryAttempt=()=>window.probe.recoveries++,never=new Promise(()=>{});
function Owner({changed,speculative}){const recoverySuspended=changed?!initial:initial;window.probe.renders.push({changed,speculative,recoverySuspended});const lifecycle=useHostRiddleLifecycle({userId:'fixture-player',accountGeneration:1,profile:{classicIndex:2},initialGameMode:'classic',locale:'en',services,withActivity,postToGame,postOperation,configurationWarning:null,setNotice,onRecoveryAttempt,recoverySuspended});if(speculative)throw never;return <main data-owner data-suspended={recoverySuspended}><output>{lifecycle.startupComplete?'Ready':'Waiting'}</output></main>;}
function App(){const [changed,setChanged]=React.useState(false),[speculative,setSpeculative]=React.useState(false);return <><button data-speculate onClick={()=>React.startTransition(()=>{setChanged(true);setSpeculative(true);})}>Speculate fixture</button><button data-commit onClick={()=>{setChanged(true);setSpeculative(false);}}>Commit fixture</button><React.Suspense fallback={<output data-fallback>Pending fixture</output>}><Owner changed={changed} speculative={speculative}/></React.Suspense></>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'recovery-suspension-baseline',enforce:'pre',async load(id){if(process.env.RECOVERY_SUSPENSION_BASELINE_FILE&&id.endsWith('/useHostRiddleLifecycle.ts'))return readFile(process.env.RECOVERY_SUSPENSION_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'&&process.env.RECOVERY_SUSPENSION_FIREFOX_EXECUTABLE?{executablePath:process.env.RECOVERY_SUSPENSION_FIREFOX_EXECUTABLE}:{})});browserVersion=browser.version();
 for(const [width,height] of process.env.RECOVERY_SUSPENSION_QUICK==='1'?[[390,844]]:[[390,568],[390,844],[1280,844]])for(const scenario of ['abandoned-suspend','abandoned-resume','committed-suspend','online-abandoned-suspend','online-abandoned-resume','online-committed-suspend']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(origin+'/?scenario='+scenario);await page.locator('[data-owner]').waitFor();await page.waitForFunction(()=>window.timerCount()===1);
  metric('initial owner starts no premature read',await page.evaluate(()=>window.probe.reads.length),0);
  if(scenario.endsWith('committed-suspend')){await page.locator('[data-commit]').click();await page.locator('[data-owner][data-suspended=true]').waitFor();}
  else{await page.locator('[data-speculate]').click();await page.waitForFunction(()=>window.probe.renders.some(x=>x.speculative));metric('abandoned render retains committed suspension',await page.locator('[data-owner]').getAttribute('data-suspended'),String(scenario.endsWith('abandoned-resume')));}
  await page.evaluate(online=>online?window.dispatchEvent(new Event('online')):window.fireRecovery(),scenario.startsWith('online-'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const expected=scenario.endsWith('abandoned-suspend')?1:0;
  metric('only committed suspension controls recovery reads',await page.evaluate(()=>window.probe.reads.length),expected);
  metric('only committed suspension controls recovery callbacks',await page.evaluate(()=>window.probe.recoveries),expected);
  metric('only admitted recovery delivers content',await page.evaluate(()=>window.probe.posts.filter(x=>x.type==='host:riddleLoaded').length),expected);
  metric('no external traffic',external,[]);metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,engine,browserVersion,cases:new Set(observations.map(x=>[x.width,x.height,x.scenario].join(':'))).size,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Only committed recovery suspension can control provider admission');
