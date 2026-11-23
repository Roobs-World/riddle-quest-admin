import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const component=path.join(root,'src/play/game/hooks/useGameBridgeLifecycle.ts');
const reporter=path.join(root,'src/observability/browserErrorReporter.ts');
const baseline=process.env.GAME_BRIDGE_ERRORS_BASELINE_SOURCE;
const reporterBaseline=process.env.GAME_BRIDGE_REPORTER_BASELINE_SOURCE;
const reactMode=process.env.GAME_BRIDGE_ERRORS_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.GAME_BRIDGE_ERRORS_REPORT_DIR??path.join(root,'../../builds/test-evidence/game-bridge-errors-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-bridge-errors-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameMessageListener} from ${JSON.stringify(component)};
import {configureBrowserErrorReporter} from ${JSON.stringify(reporter)};
import {tr} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
window.expectedFallback=tr('WebPortal.BRIDGE_ERROR');
import {HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={calls:[],messages:[],reports:[],errors:[],pending:new Map(),reporterMode:'normal',senderMode:'normal'};
window.addEventListener('error',event=>{window.probe.errors.push(event.message);event.preventDefault();});
window.addEventListener('unhandledrejection',event=>{window.probe.errors.push(String(event.reason));event.preventDefault();});
configureBrowserErrorReporter((error,context)=>{window.probe.reports.push({message:String(error),context});
  if(window.probe.reporterMode==='throw')throw new Error('telemetry adapter failed');
  if(window.probe.reporterMode==='reject')return Promise.reject(new Error('telemetry delivery failed'));
  if(window.probe.reporterMode==='close')window.dispose();});
function Harness(){const [routerVersion,setRouterVersion]=React.useState(0),[hostVersion,setHostVersion]=React.useState(0),[profile,setProfile]=React.useState(0);
  window.changeRouter=()=>setRouterVersion(value=>value+1);window.changeHost=()=>setHostVersion(value=>value+1);window.profile=()=>setProfile(value=>value+1);
  const router=React.useMemo(()=>message=>{window.probe.calls.push({message,routerVersion});
    if(message.kind==='sync')throw new Error('synchronous router failure');
    if(message.kind==='ok')return Promise.resolve();
    return new Promise((resolve,reject)=>window.probe.pending.set(message.id,{resolve,reject}));},[routerVersion]);
  const postToHost=React.useMemo(()=>message=>{if(window.probe.senderMode==='throw')throw new Error('host delivery failed');
    window.probe.messages.push({message,hostVersion});},[hostVersion]);
  useGameMessageListener({router,postToHost});
  return <main className='game-app' style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><section className='game-modal' style={{position:'static'}}>
    <h1>Game bridge recovery fixture</h1><output data-router={routerVersion} data-host={hostVersion}>Playable</output><p>Profile {profile}</p></section></main>;}
window.emit=(channel,message,origin=location.origin,source=window.parent)=>{if(channel==='local')window.dispatchEvent(new CustomEvent(HOST_TO_GAME_EVENT,{detail:message}));
  else window.dispatchEvent(new MessageEvent('message',{origin,source,data:message}));};
window.reject=(id,value)=>{window.probe.pending.get(id).reject(value==='plain'?value:new Error(value));window.probe.pending.delete(id);};
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);root.render(<React.StrictMode><Harness/></React.StrictMode>);
  window.dispose=()=>{root.unmount();node.remove();};};window.mount();
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'game-bridge-errors-baseline',enforce:'pre',async load(id){
    if(baseline&&id===component)return readFile(baseline,'utf8');if(reporterBaseline&&id===reporter)return readFile(reporterBaseline,'utf8');}}],build:{outDir:'dist',minify:false}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('output').waitFor();await flush();};
    const count=key=>page.evaluate(key=>window.probe[key].length,key);
    const emit=async(channel,id,kind='pending')=>page.evaluate(({channel,id,kind})=>window.emit(channel,{id,kind}),{channel,id,kind});
    const reject=async(id,value)=>{await page.evaluate(({id,value})=>window.reject(id,value),{id,value});await flush();};
    await mount();await page.evaluate(()=>{window.emit('native',{kind:'ok'},'https://untrusted.invalid');window.emit('native',{kind:'ok'},location.origin,null);});
    await metric('foreign origin and foreign source are rejected',await count('calls'),0);
    for(const channel of ['local','native']){
      let calls=await count('calls');await emit(channel,`${channel}-ok`,'ok');
      await metric(`${channel}: one synchronous dispatch under StrictMode`,await count('calls')-calls,1);
      let messages=await count('messages'),reports=await count('reports');await emit(channel,`${channel}-error`);await reject(`${channel}-error`,'current failure');
      await metric(`${channel}: current rejection reaches the host once`,await count('messages')-messages,1);
      await metric(`${channel}: current rejection reaches telemetry once`,await count('reports')-reports,1);
      await metric(`${channel}: error keeps its current host and message`,await page.evaluate(channel=>{const row=window.probe.messages.at(-1);return {host:row.hostVersion,type:row.message.type,message:row.message.payload.message,prefix:row.message.requestId.startsWith(channel==='local'?'local-parse-error':'parse-error')};},channel),{host:channel==='local'?0:1,type:'game:error',message:'current failure',prefix:true});
      await emit(channel,`${channel}-old-router`);messages=await count('messages');reports=await count('reports');await page.evaluate(()=>window.changeRouter());await flush();await reject(`${channel}-old-router`,'retired router');
      await metric(`${channel}: replaced router cannot report late failures`,await count('messages')-messages,0);
      await metric(`${channel}: replaced router cannot report late telemetry`,await count('reports')-reports,0);
      await emit(channel,`${channel}-old-host`);messages=await count('messages');await page.evaluate(()=>window.changeHost());await flush();await reject(`${channel}-old-host`,'retired host');
      await metric(`${channel}: replacement host retires old pending error replies`,await count('messages')-messages,0);
      calls=await count('calls');await page.evaluate(()=>window.profile());await flush();await emit(channel,`${channel}-profile`,'ok');
      await metric(`${channel}: profile updates preserve a single current listener`,await count('calls')-calls,1);
      messages=await count('messages');await emit(channel,`${channel}-sync`,'sync');await flush();
      await metric(`${channel}: synchronous router failure produces an error reply`,await count('messages')-messages,1);
      await emit(channel,`${channel}-plain`);await reject(`${channel}-plain`,'plain');
      await metric(`${channel}: non-Error rejection uses existing translated fallback`,await page.evaluate(()=>window.probe.messages.at(-1).message.payload.message===window.expectedFallback),true);
    }
    // Both native and local replies must survive a failing optional target reporter.
    for(const channel of ['local','native'])for(const mode of ['throw','reject']){
      await page.evaluate(mode=>window.probe.reporterMode=mode,mode);const messages=await count('messages');await emit(channel,`${channel}-${mode}`);await reject(`${channel}-${mode}`,`failure with ${mode}`);
      await metric(`${channel}: ${mode} from optional telemetry preserves error delivery`,await count('messages')-messages,1);
    }
    await page.evaluate(()=>{window.probe.reporterMode='normal';window.probe.senderMode='throw';});await emit('local','failed-delivery');await reject('failed-delivery','original failure');
    await metric('throwing host sender is reported without a recursive error reply',await page.evaluate(()=>window.probe.reports.at(-1).message),'Error: host delivery failed');
    await page.evaluate(()=>window.probe.senderMode='normal');const recoveredMessages=await count('messages');await emit('local','recovered-delivery');await reject('recovered-delivery','recovered host');
    await metric('a failed error reply leaves the current listener usable',await count('messages')-recoveredMessages,1);await emit('local','closed-local');await emit('native','closed-native');let messages=await count('messages'),reports=await count('reports');
    await page.evaluate(()=>window.dispose());await reject('closed-local','closed local');await reject('closed-native','closed native');
    await metric('unmount suppresses both late error replies',await count('messages')-messages,0);
    await metric('unmount suppresses both late telemetry calls',await count('reports')-reports,0);
    const calls=await count('calls');await emit('local','closed-ok','ok');await emit('native','closed-ok','ok');
    await metric('unmount removes both message listeners',await count('calls')-calls,0);
    await metric('routing and reporting failures create no uncaught browser errors',await page.evaluate(()=>window.probe.errors),[]);
    await mount();await page.evaluate(()=>window.probe.reporterMode='close');await emit('local','telemetry-close');await reject('telemetry-close','telemetry closes game');
    await metric('telemetry-triggered unmount retires the reply before host delivery',await count('messages'),0);
    await mount();await page.screenshot({path:path.join(output,`recovered-${width}.png`)});
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+reactMode+' '+width+'px game bridge errors');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline game bridge error regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
