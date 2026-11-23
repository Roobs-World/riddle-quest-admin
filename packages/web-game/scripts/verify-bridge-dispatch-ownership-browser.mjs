import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const before=process.env.BRIDGE_DISPATCH_BASELINE_DIR;
const reactMode=process.env.BRIDGE_DISPATCH_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.BRIDGE_DISPATCH_REPORT_DIR??path.join(root,'../../builds/test-evidence/bridge-dispatch-ownership-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/bridge-dispatch-'));
const sources=['src/play/bridgeRouter.ts','src/play/useHostBridgeLifecycle.ts','src/play/game/hooks/useGameBridgeLifecycle.ts','src/play/useGameMessageRouter.ts','src/play/useHostNotice.ts'].map(file=>path.join(root,file));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {createHostMessageRouter} from ${JSON.stringify(sources[0])};
import {useHostBridgeLifecycle} from ${JSON.stringify(sources[1])};
import {useGameMessageListener} from ${JSON.stringify(sources[2])};
import {useGameMessageRouter} from ${JSON.stringify(sources[3])};
import {useHostNotice} from ${JSON.stringify(sources[4])};
import {useHostAuthSession} from ${JSON.stringify(path.join(root,'src/play/useHostAuthSession.ts'))};
import {HOST_TO_GAME_EVENT,GAME_TO_HOST_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={effects:[],messages:[],settled:0,errors:[]};
window.addEventListener('error',event=>{window.probe.errors.push(event.message);event.preventDefault();});
window.addEventListener('unhandledrejection',event=>{window.probe.errors.push(String(event.reason));event.preventDefault();});
function createAuth(){let current={user:{uid:'Alice',isAnonymous:false,accountGeneration:1},profile:{coins:300}};const listeners=new Set();return {subscribe(callback){listeners.add(callback);callback(current);return()=>listeners.delete(callback);},publish(uid,generation=1,coins=300){current={user:uid?{uid,isAnonymous:false,accountGeneration:generation}:null,profile:uid?{coins}:null};for(const listener of listeners)listener(current);}};}
const observe=promise=>{promise.finally(()=>window.probe.settled++).catch(()=>{});return promise;};
function Host(){const [auth,setAuth]=React.useState(createAuth);window.changeProvider=()=>setAuth(createAuth());window.publish=(...args)=>auth.publish(...args);
  const authPost=React.useCallback(()=>{},[]),host=useHostAuthSession({services:{auth},postToGame:authPost});
  const notice=useHostNotice({owner:host.captureAccount,configurationWarning:window.warning??null,ownsMessage:host.snapshot.user?host.captureAccount(host.snapshot.user.uid):undefined});
  window.setNotice=notice.setNotice;window.notice=notice.notice;
  const router=React.useMemo(()=>{const handler=message=>window.probe.effects.push({message,owner:host.snapshot.user?.uid??null});
    const execute=createHostMessageRouter(new Proxy({},{get:()=>handler}));return (message,owned)=>observe(execute(message,owned));},[host.snapshot]);
  const postToGame=React.useCallback(message=>window.probe.messages.push(message),[]);
  useHostBridgeLifecycle({router,postToGame,setNotice:notice.setNotice,ownsMessage:host.captureAccount(host.snapshot.user?.uid)});
  return <output data-owner={host.snapshot.user?.uid??'signed-out'} data-generation={host.snapshot.user?.accountGeneration??0}>{notice.notice??'Playable'}</output>;}
function Game(){const [version,setVersion]=React.useState(0),[display,setDisplay]=React.useState('Playable');window.replaceRouter=()=>setVersion(value=>value+1);
  const stateRef=React.useRef({profile:{coins:300},lastOutcome:null});const dispatch=React.useMemo(()=>action=>{window.probe.effects.push({action,version});setDisplay(action.type);},[version]);
  const post=React.useCallback(()=>{},[]),requestRiddle=React.useCallback(()=>{},[]);
  const execute=useGameMessageRouter({dispatch,stateRef,postToHost:post,requestRiddle});const router=React.useMemo(()=>(message,owned)=>observe(execute(message,owned)),[execute]);
  useGameMessageListener({router,postToHost:post});return <output data-version={version}>{display}</output>;}
window.emit=(side,message)=>window.dispatchEvent(new CustomEvent(side==='host'?GAME_TO_HOST_EVENT:HOST_TO_GAME_EVENT,{detail:message}));
window.mount=(side,warning)=>{window.warning=warning;const node=document.createElement('div');document.body.appendChild(node);const root=createRoot(node);root.render(<React.StrictMode><main className='game-app' style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><section className='game-modal' style={{position:'static'}}><h1>Bridge dispatch fixture</h1>{side==='host'?<Host/>:<Game/>}</section></main></React.StrictMode>);window.dispose=()=>{root.unmount();node.remove();};};
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[],heldRoutes=new Set();
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'bridge-dispatch-baseline',enforce:'pre',async load(id){if(before&&sources.includes(id))return readFile(path.join(before,path.basename(id).replace('.ts','.before.txt')),'utf8');}}],build:{outDir:'dist',minify:false}});
  const schemaAssets=[];for(const file of await readdir(path.join(scratch,'dist/assets'))){if(file.endsWith('.js')&&/BridgeProfileSchema\s*=/.test(await readFile(path.join(scratch,'dist/assets',file),'utf8')))schemaAssets.push(`/assets/${file}`);}
  assert.equal(schemaAssets.length,1,'Fixture must expose the real lazy bridge validation chunk');
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));}catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();let releaseSchema=()=>{},schemaRequests=0,holdSchema=false;
    await page.route('**/assets/*.js',async route=>{if(schemaAssets.includes(new URL(route.request().url()).pathname)){schemaRequests++;if(holdSchema){let resume;await new Promise(resolve=>{resume=resolve;releaseSchema=resolve;heldRoutes.add(resolve);});heldRoutes.delete(resume);}}await route.continue();});
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!before)assert.deepEqual(actual,expected,name);};
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const mount=async(side,hold=false,warning=null)=>{releaseSchema();holdSchema=hold;schemaRequests=0;await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(({side,warning})=>window.mount(side,warning),{side,warning});await page.locator(side==='host'?'[data-owner=Alice]':'[data-version="0"]').waitFor();await flush();};
    const effects=()=>page.evaluate(()=>window.probe.effects.length);
    const emit=(side,message)=>page.evaluate(({side,message})=>window.emit(side,message),{side,message});
    const spend={type:'game:spendCoins',requestId:'continue-owned',payload:{amount:100,reason:'continue',gameMode:'classic',riddleId:'classic_1',sessionToken:'00000000-0000-4000-8000-000000000001'}};
    const question={type:'host:riddleLoaded',requestId:'load-owned',payload:{riddle:{riddleId:'classic_1',text:'What has keys?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false},profile:null}};
    const cold=async(side,message)=>{const requested=page.waitForRequest(request=>schemaAssets.includes(new URL(request.url()).pathname));await emit(side,message);await requested;await metric(`${side}: cold handler waits for actual validation bytes`,await effects(),0);};
    const finishCold=async(count=1)=>{holdSchema=false;releaseSchema();await page.waitForFunction(count=>window.probe.settled>=count,count);await flush();};
    for(const change of ['account','generation','return','provider','sign-out','close']){
      await mount('host',true);await cold('host',spend);await page.evaluate(change=>{if(change==='account')window.publish('Bob');else if(change==='generation')window.publish('Alice',2);else if(change==='return'){window.publish('Bob');window.publish('Alice');}else if(change==='provider')window.changeProvider();else if(change==='sign-out')window.publish(null);else window.dispose();},change);await flush();await finishCold();
      await metric(`${change}: retired cold command never starts an authority mutation`,await effects(),0);await metric(`${change}: retired cold command produces no uncaught error`,await page.evaluate(()=>window.probe.errors),[]);
    }
    await mount('host',true);await cold('host',spend);await emit('host',{...spend,requestId:'continue-second'});await page.evaluate(()=>window.publish('Alice',1,301));await flush();await finishCold(2);
    await metric('profile-only update keeps both independently owned cold commands',await effects(),2);await metric('concurrent cold commands share one parser download',schemaRequests,1);
    const warmHost=await page.evaluate(message=>{const before=window.probe.effects.length;window.emit('host',message);return window.probe.effects.length-before;},{type:'game:resize',payload:{width,height:844}});
    await metric('warm host dispatch enters its handler synchronously',warmHost,1);
    for(const change of ['router','close']){await mount('game',true);await cold('game',question);await page.evaluate(change=>change==='router'?window.replaceRouter():window.dispose(),change);await flush();await finishCold();await metric(`${change}: cold host result cannot mutate a retired game listener`,await effects(),0);}
    await mount('game',true);await cold('game',question);await finishCold();await metric('current cold host result reaches the game once',await effects(),1);
    const warmGame=await page.evaluate(()=>{const before=window.probe.effects.length;window.emit('game',{type:'host:pause',payload:{}});return window.probe.effects.length-before;});await metric('warm game dispatch enters its handler synchronously',warmGame,1);
    for(const operation of ['profile','leaderboard']){
      await mount('game');await emit('game',{type:'host:pause',payload:{}});await page.waitForFunction(()=>window.probe.settled===1);const previous=await effects();
      await page.evaluate(operation=>{window.emit('game',{type:'host:operationResult',payload:{operation,ok:true,data:operation==='profile'?{profile:{username:'Alice',coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:0}}:{type:'xp',entries:[]}}});window.dispose();},operation);await page.waitForFunction(()=>window.probe.settled===2);
      await metric(`${operation}: additional asynchronous schema work cannot dispatch after unmount`,await effects()-previous,0);
    }
    await mount('host');await page.evaluate(()=>{window.savedNoticeSetter=window.setNotice;window.setNotice('Alice notice');});await flush();await metric('current notice is visible',await page.locator('output').textContent(),'Alice notice');
    await page.evaluate(()=>window.publish('Alice',1,301));await flush();await metric('profile-only update preserves the notice',await page.locator('output').textContent(),'Alice notice');await metric('profile-only update preserves its setter identity',await page.evaluate(()=>window.savedNoticeSetter===window.setNotice),true);
    await page.evaluate(()=>window.publish('Bob'));await flush();await metric('new account cannot inherit an already-rendered notice',await page.locator('output').textContent(),'Playable');
    await page.evaluate(()=>window.setNotice('Bob notice'));await flush();await page.evaluate(()=>window.savedNoticeSetter(null));await flush();await metric('old dismiss callback cannot clear the new account notice',await page.locator('output').textContent(),'Bob notice');
    await page.evaluate(()=>window.savedNoticeSetter('late Alice notice'));await flush();await metric('old callback cannot replace the new account notice',await page.locator('output').textContent(),'Bob notice');
    await page.evaluate(()=>{window.savedBobSetter=window.setNotice;window.publish('Bob',2);window.savedBobSetter('retired generation');});await flush();await metric('same-UID generation change retires visible and pre-render queued notices',await page.locator('output').textContent(),'Playable');
    await page.evaluate(()=>{window.publish('Alice');window.savedNoticeSetter('revived Alice notice');});await flush();await metric('returning to the same UID cannot revive an old notice setter',await page.locator('output').textContent(),'Playable');
    await page.evaluate(()=>{window.setNotice('provider notice');});await flush();await page.evaluate(()=>window.changeProvider());await flush();await metric('identity-provider replacement clears a previously rendered notice',await page.locator('output').textContent(),'Playable');
    await mount('host',false,'Target configuration warning');await page.evaluate(()=>window.setNotice('Transient notice'));await flush();await page.evaluate(()=>window.publish('Bob'));await flush();await metric('target configuration warning survives account replacement',await page.locator('output').textContent(),'Target configuration warning');
    await metric('notice ownership produces no uncaught errors',await page.evaluate(()=>window.probe.errors),[]);
    await page.screenshot({path:path.join(output,`owned-notice-${width}.png`)});await context.close();console.log((before?'BASELINE ':'PASS ')+reactMode+' '+width+'px bridge dispatch and notice ownership');
  }
  await writeFile(path.join(output,before?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(before)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline bridge dispatch and notice regressions reproduced');
}finally{for(const resume of heldRoutes)resume();await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
