import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const component=path.join(root,'src/play/useHostBridgeLifecycle.ts');
const baseline=process.env.HOST_BRIDGE_BASELINE_SOURCE;
const reactMode=process.env.HOST_BRIDGE_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.HOST_BRIDGE_REPORT_DIR??path.join(root,'../../builds/test-evidence/host-bridge-ownership-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/host-bridge-ownership-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostBridgeLifecycle} from ${JSON.stringify(component)};
import {useHostAuthSession} from ${JSON.stringify(path.join(root,'src/play/useHostAuthSession.ts'))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,'src/observability/browserErrorReporter.ts'))};
import {getHostErrorMessage} from ${JSON.stringify(path.join(root,'src/play/hostMessageHandlers.ts'))};
import {GAME_TO_HOST_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={calls:[],messages:[],notices:[],reports:[],errors:[],pending:new Map(),reporterMode:'normal',senderMode:'normal',noticeMode:'normal',auths:[],lifecycles:[],bridgeAdds:0,bridgeRemoves:0,visibilityAdds:0,visibilityRemoves:0};
window.addEventListener('error',event=>{window.probe.errors.push(event.message);event.preventDefault();});
window.addEventListener('unhandledrejection',event=>{window.probe.errors.push(String(event.reason));event.preventDefault();});
configureBrowserErrorReporter((error,context)=>{window.probe.reports.push({message:String(error),context});
  if(window.probe.reporterMode==='throw')throw new Error('telemetry failed');if(window.probe.reporterMode==='reject')return Promise.reject(new Error('telemetry rejected'));
  if(window.probe.reporterMode==='close')window.dispose();if(window.probe.reporterMode==='replace')window.changeAccount('TelemetryReplacement',1);});
const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),docAdd=document.addEventListener.bind(document),docRemove=document.removeEventListener.bind(document);
window.addEventListener=(type,...args)=>{if(type===GAME_TO_HOST_EVENT)window.probe.bridgeAdds++;return add(type,...args);};
window.removeEventListener=(type,...args)=>{if(type===GAME_TO_HOST_EVENT)window.probe.bridgeRemoves++;return remove(type,...args);};
document.addEventListener=(type,...args)=>{if(type==='visibilitychange')window.probe.visibilityAdds++;return docAdd(type,...args);};
document.removeEventListener=(type,...args)=>{if(type==='visibilitychange')window.probe.visibilityRemoves++;return docRemove(type,...args);};
function createAuth(id){const listeners=new Set();let snapshot={user:{uid:'Alice',isAnonymous:false,accountGeneration:1},profile:{coins:300}};
  const auth={id,adds:0,removes:0,subscribe(listener){this.adds++;listeners.add(listener);listener(snapshot);return()=>{this.removes++;listeners.delete(listener);};},
    publish(uid,generation=1,coins=300){snapshot={user:uid===null?null:{uid,isAnonymous:false,accountGeneration:generation},profile:uid===null?null:{coins}};for(const listener of listeners)listener(snapshot);}};
  window.probe.auths.push(auth);return auth;}
function createLifecycle(id,mode='normal'){const callbacks=[],removed=[];const register=(kind,callback)=>{const entry={kind,callback,active:true};callbacks.push(entry);if(mode==='register-'+kind)throw new Error(kind+' registration failed');return()=>{entry.active=false;removed.push(kind);if(mode==='unsubscribe-'+kind)throw new Error(kind+' cleanup failed');};};
  const provider={id,callbacks,removed,onPause:callback=>register('pause',callback),onResume:callback=>register('resume',callback),
    fire(kind,retired=false){for(const entry of callbacks)if(entry.kind===kind&&entry.active===!retired)try{entry.callback();}catch(error){window.probe.errors.push('SDK callback: '+String(error));}}};window.probe.lifecycles.push(provider);return provider;}
function Harness(){const [auth,setAuth]=React.useState(()=>createAuth(0)),[lifecycle,setLifecycle]=React.useState(()=>createLifecycle(0)),[routerVersion,setRouterVersion]=React.useState(0),[hostVersion,setHostVersion]=React.useState(0),[noticeVersion,setNoticeVersion]=React.useState(0),[notice,setLocalNotice]=React.useState(null);
  window.currentAuth=auth;window.currentLifecycle=lifecycle;window.changeAccount=(uid,generation,coins)=>auth.publish(uid,generation,coins);
  window.changeProvider=()=>setAuth(createAuth(window.probe.auths.length));window.changeLifecycle=mode=>setLifecycle(createLifecycle(window.probe.lifecycles.length,mode));
  window.changeRouter=()=>setRouterVersion(value=>value+1);window.changeHost=()=>setHostVersion(value=>value+1);window.changeNotice=()=>setNoticeVersion(value=>value+1);
  const authPost=React.useCallback(()=>{},[]);const host=useHostAuthSession({services:{auth},postToGame:authPost});
  const router=React.useMemo(()=>message=>{window.probe.calls.push({message,routerVersion,uid:host.snapshot.user?.uid??null,provider:auth.id});
    if(message.kind==='sync')throw new Error('synchronous route failure');if(message.kind==='ok')return Promise.resolve(message);
    return new Promise((resolve,reject)=>window.probe.pending.set(message.id,{resolve,reject}));},[auth,host.snapshot,routerVersion]);
  const postToGame=React.useMemo(()=>message=>{if(window.probe.senderMode==='throw')throw new Error('lifecycle delivery failed');window.probe.messages.push({message,hostVersion});},[hostVersion]);
  const setNotice=React.useMemo(()=>value=>{if(window.probe.noticeMode==='throw')throw new Error('notice delivery failed');window.probe.notices.push({notice:value,noticeVersion,uid:host.snapshot.user?.uid??null});setLocalNotice(value);},[host.snapshot.user,noticeVersion]);
  useHostBridgeLifecycle({router,postToGame,setNotice,lifecycle,ownsMessage:host.captureAccount(host.snapshot.user?.uid)});
  return <main className='game-app' style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><section className='game-modal' style={{position:'static'}}>
    <h1>Host bridge recovery fixture</h1><output data-owner={host.snapshot.user?.uid??'signed-out'} data-generation={host.snapshot.user?.accountGeneration??0}>{notice??'Playable'}</output>
    <p>Provider {auth.id}, host {hostVersion}, router {routerVersion}</p></section></main>;}
window.emit=(id,kind='pending')=>window.dispatchEvent(new CustomEvent(GAME_TO_HOST_EVENT,{detail:{id,kind}}));
window.reject=(id,value)=>{window.probe.pending.get(id).reject(value);window.probe.pending.delete(id);};
window.visibility=state=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:state});document.dispatchEvent(new Event('visibilitychange'));};
class Boundary extends React.Component {state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(error){window.probe.errors.push('Host effect: '+String(error));}render(){return this.state.failed?<output data-fixture-status='failed'>Provider failure</output>:this.props.children;}}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);root.render(<React.StrictMode><Boundary><Harness/></Boundary></React.StrictMode>);
  window.dispose=()=>{root.unmount();node.remove();};};window.mount();
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'host-bridge-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(baseline,'utf8');}}],build:{outDir:'dist',minify:false}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('[data-owner=Alice]').waitFor();await flush();};
    const count=key=>page.evaluate(key=>window.probe[key].length,key);
    const emit=(id,kind='pending')=>page.evaluate(({id,kind})=>window.emit(id,kind),{id,kind});
    const reject=async(id,message)=>{await page.evaluate(({id,message})=>window.reject(id,new Error(message)),{id,message});await flush();};
    await mount();let calls=await count('calls');await emit('initial-ok','ok');await metric('one immediate message dispatch under StrictMode',await count('calls')-calls,1);
    const subscriptions=await page.evaluate(()=>({bridge:window.probe.bridgeAdds,visibility:window.probe.visibilityAdds,provider:window.currentLifecycle.callbacks.length,auth:window.currentAuth.adds}));
    await emit('profile-pending');await page.evaluate(()=>{window.changeAccount('Alice',1,301);window.changeRouter();window.changeHost();window.changeNotice();});await flush();let notices=await count('notices');await reject('profile-pending','current account failure');
    await metric('profile and callback replacement preserve current pending errors',await count('notices')-notices,1);
    await metric('current failure uses the latest notice sink',await page.evaluate(()=>window.probe.notices.at(-1)),{notice:'current account failure',noticeVersion:1,uid:'Alice'});
    await metric('ordinary host renders keep all stable subscriptions',await page.evaluate(()=>({bridge:window.probe.bridgeAdds,visibility:window.probe.visibilityAdds,provider:window.currentLifecycle.callbacks.length,auth:window.currentAuth.adds})),subscriptions);
    await emit('old-account');notices=await count('notices');let reports=await count('reports');calls=await count('calls');
    await page.evaluate(()=>{window.changeAccount('Bob',1);window.reject('old-account',new Error('Alice failure'));window.emit('before-account-render','ok');});await flush();
    await metric('account notification retires delayed notices before render',await count('notices')-notices,0);
    await metric('account notification retires delayed telemetry before render',await count('reports')-reports,0);
    await metric('messages cannot enter the old router before account render',await count('calls')-calls,0);
    await emit('bob-ok','ok');await metric('rendered replacement uses its new router',await page.evaluate(()=>window.probe.calls.at(-1).uid),'Bob');
    await emit('old-generation');notices=await count('notices');await page.evaluate(()=>{window.changeAccount('Bob',2);window.reject('old-generation',new Error('old generation'));});await flush();
    await metric('same UID with a new generation retires pending notices',await count('notices')-notices,0);
    await emit('old-visit');notices=await count('notices');await page.evaluate(()=>{window.changeAccount('Alice',1);window.changeAccount('Bob',2);window.reject('old-visit',new Error('old visit'));});await flush();
    await metric('leave and return to the same UID does not revive old notices',await count('notices')-notices,0);
    await emit('signed-out');notices=await count('notices');calls=await count('calls');await page.evaluate(()=>{window.changeAccount(null);window.reject('signed-out',new Error('signed-out failure'));window.emit('signed-out-message','ok');});await flush();
    await metric('sign-out suppresses delayed account errors',await count('notices')-notices,0);await metric('signed-out account cannot route a game message',await count('calls')-calls,0);
    await page.evaluate(()=>window.changeAccount('Alice',1));await flush();await emit('old-provider');notices=await count('notices');await page.evaluate(()=>window.changeProvider());await flush();await reject('old-provider','old identity provider');
    await metric('same-UID identity-provider replacement retires pending notices',await count('notices')-notices,0);
    await emit('new-provider','ok');await metric('replacement identity provider remains routable',await page.evaluate(()=>window.probe.calls.at(-1).provider===window.currentAuth.id),true);
    await emit('old-lifecycle');notices=await count('notices');const oldCallbacks=await page.evaluate(()=>{const id=window.probe.lifecycles.indexOf(window.currentLifecycle);window.changeLifecycle();return id;});await flush();await reject('old-lifecycle','retired listener failure');
    await metric('provider lifecycle replacement retires pending listener errors',await count('notices')-notices,0);
    let messages=await count('messages');await page.evaluate(id=>{window.probe.lifecycles[id].fire('pause',true);window.probe.lifecycles[id].fire('resume',true);},oldCallbacks);
    await metric('queued retired SDK callbacks cannot pause the replacement game',await count('messages')-messages,0);
    messages=await count('messages');await page.evaluate(()=>{window.currentLifecycle.fire('pause');window.currentLifecycle.fire('resume');});
    await metric('current SDK pause and resume remain synchronous',await count('messages')-messages,2);
    await metric('current lifecycle delivery uses the latest host sender',await page.evaluate(()=>window.probe.messages.slice(-2).map(row=>({type:row.message.type,host:row.hostVersion}))),[{type:'host:pause',host:1},{type:'host:resume',host:1}]);
    await page.evaluate(()=>window.visibility('hidden'));messages=await count('messages');await page.evaluate(()=>window.currentLifecycle.fire('resume'));
    await metric('SDK resume is suppressed while the document is hidden',await count('messages')-messages,0);
    await metric('hidden document sends pause',await page.evaluate(()=>window.probe.messages.at(-1).message.type),'host:pause');await page.evaluate(()=>window.visibility('visible'));
    await metric('visible document sends resume',await page.evaluate(()=>window.probe.messages.at(-1).message.type),'host:resume');
    notices=await count('notices');await emit('sync','sync');await flush();await metric('synchronous route failure becomes a host notice',await count('notices')-notices,1);
    for(const mode of ['throw','reject']){await page.evaluate(mode=>window.probe.reporterMode=mode,mode);notices=await count('notices');await emit(mode);await reject(mode,'optional telemetry failure');
      await metric(`${mode} from optional telemetry preserves host recovery`,await count('notices')-notices,1);}
    await page.evaluate(()=>{window.probe.reporterMode='normal';window.probe.noticeMode='throw';});await emit('notice-delivery');await reject('notice-delivery','original route failure');
    await metric('failed notice delivery is observed without a recursive notice',await page.evaluate(()=>window.probe.reports.at(-1).message),'Error: notice delivery failed');
    await page.evaluate(()=>{window.probe.noticeMode='normal';window.probe.senderMode='throw';});reports=await count('reports');await page.evaluate(()=>{window.visibility('hidden');window.currentLifecycle.fire('pause');window.visibility('visible');window.currentLifecycle.fire('resume');});await flush();
    await metric('all lifecycle sender failures are observed safely',await count('reports')-reports,4);
    await page.evaluate(()=>window.probe.senderMode='normal');await emit('unmounted');notices=await count('notices');reports=await count('reports');messages=await count('messages');calls=await count('calls');
    await page.evaluate(()=>window.dispose());await reject('unmounted','unmounted failure');await emit('closed-ok','ok');await page.evaluate(()=>{window.visibility('hidden');for(const provider of window.probe.lifecycles){provider.fire('pause',true);provider.fire('resume',true);}});
    await metric('unmount retires pending notices',await count('notices')-notices,0);await metric('unmount retires pending telemetry',await count('reports')-reports,0);
    await metric('unmount removes the message subscription',await count('calls')-calls,0);await metric('unmount suppresses retained SDK callbacks',await count('messages')-messages,0);
    await metric('unmount balances local bridge subscriptions',await page.evaluate(()=>window.probe.bridgeAdds-window.probe.bridgeRemoves),0);
    await metric('unmount balances visibility subscriptions',await page.evaluate(()=>window.probe.visibilityAdds-window.probe.visibilityRemoves),0);
    await metric('unmount retires every provider callback',await page.evaluate(()=>window.probe.lifecycles.flatMap(provider=>provider.callbacks).filter(entry=>entry.active).length),0);
    await metric('host recovery has no uncaught browser errors',await page.evaluate(()=>window.probe.errors),[]);
    for(const mode of ['close','replace']){await mount();await page.evaluate(mode=>window.probe.reporterMode=mode,mode);await emit(mode);await reject(mode,'telemetry changes ownership');
      await metric(`${mode} during telemetry retires the notice before delivery`,await count('notices'),0);}
    for(const kind of ['pause','resume']){
      await mount();await page.evaluate(kind=>window.changeLifecycle('register-'+kind),kind);await flush();
      await metric(`${kind} registration failure keeps the game mounted`,await page.locator('[data-owner=Alice]').count(),1);
      messages=await count('messages');await page.evaluate(kind=>window.currentLifecycle.fire(kind),kind);
      await metric(`${kind} registration failure retires a callback retained by the SDK`,await count('messages')-messages,0);
      messages=await count('messages');await page.evaluate(kind=>window.currentLifecycle.fire(kind==='pause'?'resume':'pause'),kind);
      await metric(`${kind} registration failure preserves the other provider signal`,await count('messages')-messages,1);
      await page.evaluate(()=>window.visibility('hidden'));await metric(`${kind} registration failure preserves browser visibility delivery`,await page.evaluate(()=>window.probe.messages.at(-1)?.message.type),'host:pause');
      await metric(`${kind} registration failure is reported without an uncaught effect error`,await page.evaluate(()=>({errors:window.probe.errors,reported:window.probe.reports.some(row=>row.message.includes('registration failed'))})),{errors:[],reported:true});
      await page.evaluate(()=>window.dispose());await metric(`${kind} registration failure leaves no local bridge listener after unmount`,await page.evaluate(()=>window.probe.bridgeAdds-window.probe.bridgeRemoves),0);
      await mount();await page.evaluate(kind=>window.changeLifecycle('unsubscribe-'+kind),kind);await flush();const retiring=await page.evaluate(()=>window.probe.lifecycles.indexOf(window.currentLifecycle));
      await page.evaluate(()=>window.changeLifecycle());await flush();
      await metric(`${kind} cleanup failure keeps the replacement game mounted`,await page.locator('[data-owner=Alice]').count(),1);
      await metric(`${kind} cleanup failure still detaches both provider subscriptions`,await page.evaluate(id=>window.probe.lifecycles[id].removed,retiring),['pause','resume']);
      await metric(`${kind} cleanup failure is observed without an uncaught effect error`,await page.evaluate(()=>({errors:window.probe.errors,reported:window.probe.reports.some(row=>row.message.includes('cleanup failed'))})),{errors:[],reported:true});
      messages=await count('messages');await page.evaluate(id=>{window.probe.lifecycles[id].fire('pause',true);window.probe.lifecycles[id].fire('resume',true);},retiring);
      await metric(`${kind} cleanup failure cannot revive retired callbacks`,await count('messages')-messages,0);
      await page.evaluate(()=>window.dispose());await metric(`${kind} cleanup failure leaves no local bridge listener after unmount`,await page.evaluate(()=>window.probe.bridgeAdds-window.probe.bridgeRemoves),0);
    }
    await mount();await page.screenshot({path:path.join(output,`recovered-${width}.png`)});await context.close();console.log((baseline?'BASELINE ':'PASS ')+reactMode+' '+width+'px host bridge account ownership');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline host bridge ownership regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
