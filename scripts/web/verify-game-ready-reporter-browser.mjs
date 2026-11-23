import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const component=path.join(root,'src/web/play/game/hooks/useGameBridgeLifecycle.ts');
const baseline=process.env.GAME_READY_BASELINE_SOURCE;
const reactMode=process.env.GAME_READY_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.GAME_READY_REPORT_DIR??path.join(root,'builds/test-evidence/game-bridge-idle-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-ready-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameReadyReporter} from ${JSON.stringify(component)};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.probe={ready:[],messages:[],ticks:0,intervals:new Map(),observers:[]};
window.watch=()=>{const schedule=window.setInterval.bind(window),clear=window.clearInterval.bind(window),NativeObserver=window.ResizeObserver;
  window.setInterval=(callback,delay,...args)=>{if(delay!==750)return schedule(callback,delay,...args);
    const id=schedule(()=>{window.probe.ticks++;callback(...args);},delay);window.probe.intervals.set(id,callback);return id;};
  window.clearInterval=id=>{window.probe.intervals.delete(id);clear(id);};
  window.ResizeObserver=class {constructor(callback){this.callback=callback;this.disconnected=false;
    this.native=new NativeObserver((...args)=>{if(!this.disconnected)callback(...args);});window.probe.observers.push(this);}
    observe(element){this.native.observe(element);}disconnect(){this.disconnected=true;this.native.disconnect();}};
  window.notify=retired=>{for(const observer of window.probe.observers)if(observer.disconnected===!!retired)observer.callback([]);};};
function Harness(){const [initialized,setInitialized]=React.useState(!!window.initializedOnMount),[readyVersion,setReadyVersion]=React.useState(0),[hostVersion,setHostVersion]=React.useState(0),[profile,setProfile]=React.useState(0);
  window.initialize=()=>setInitialized(true);window.recover=()=>setInitialized(false);window.changeReady=()=>setReadyVersion(value=>value+1);
  window.changeHost=()=>setHostVersion(value=>value+1);window.profile=()=>setProfile(value=>value+1);
  const postToHost=React.useMemo(()=>message=>window.probe.messages.push({message,hostVersion}),[hostVersion]);
  const sendReady=React.useMemo(()=>()=>window.probe.ready.push({readyVersion,hostVersion}),[readyVersion,postToHost]);
  useGameReadyReporter({initialized,sendReady,postToHost});
  return <main className='game-app' style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><section className='game-modal' style={{position:'static'}}>
    <h1>Game bridge fixture</h1><output data-initialized={initialized?'yes':'no'}>{initialized?'Playable':'Waiting for host'}</output>
    <p>Profile {profile} / host {hostVersion} / ready callback {readyVersion}</p></section></main>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);root.render(<React.StrictMode><Harness/></React.StrictMode>);
  window.dispose=()=>{root.unmount();node.remove();};};
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'game-ready-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(baseline,'utf8');}}],build:{outDir:'dist',minify:false}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const mount=async(initialized=false)=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(initialized=>{
      window.initializedOnMount=initialized;window.watch();window.mount();},initialized);await page.locator('output').waitFor();await page.clock.runFor(30);await flush();};
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const snapshot=()=>page.evaluate(()=>({ready:window.probe.ready.length,ticks:window.probe.ticks,intervals:window.probe.intervals.size,
      observers:window.probe.observers.length,activeObservers:window.probe.observers.filter(observer=>!observer.disconnected).length,
      resizes:window.probe.messages.filter(row=>row.message.type==='game:resize').length}));
    await mount();await metric('uninitialized game sends its immediate ready signal',await page.evaluate(()=>window.probe.ready.length),1);
    await page.clock.runFor(1500);await metric('unanswered handshake keeps one bounded retry cadence',await page.evaluate(()=>window.probe.ready.length),3);
    await metric('unanswered handshake owns one retry interval',await page.evaluate(()=>window.probe.intervals.size),1);
    await page.evaluate(()=>window.initialize());await page.locator('[data-initialized=yes]').waitFor();await flush();
    await metric('initialized game retires its ready interval',await page.evaluate(()=>window.probe.intervals.size),0);
    const idleBefore=await snapshot();await page.clock.runFor(7500);const idleAfter=await snapshot();
    await metric('initialized game has zero ready timer wakes over 7.5 seconds',idleAfter.ticks-idleBefore.ticks,0);
    await metric('initialized game sends no further readiness signal',idleAfter.ready-idleBefore.ready,0);
    const resizeBefore=await page.evaluate(()=>window.probe.messages.length);
    await page.evaluate(()=>{for(let index=0;index<10;index++){window.dispatchEvent(new Event('resize'));window.notify(false);}});
    await metric('unchanged resize bursts send no duplicate bridge dimensions',(await page.evaluate(()=>window.probe.messages.length))-resizeBefore,0);
    const profileBefore=await snapshot();await page.evaluate(()=>window.profile());await flush();const profileAfter=await snapshot();
    await metric('ordinary profile updates preserve the resize observer',profileAfter.observers,profileBefore.observers);
    await metric('ordinary profile updates do not restart readiness',profileAfter.ready,profileBefore.ready);
    const readyBefore=await snapshot();await page.evaluate(()=>window.changeReady());await flush();await page.clock.runFor(30);const readyAfter=await snapshot();
    await metric('ready callback replacement preserves resize observation',readyAfter.observers,readyBefore.observers);
    await metric('ready callback replacement does not emit after initialization',readyAfter.ready,readyBefore.ready);
    await metric('ready callback replacement keeps ready timers stopped',readyAfter.intervals,0);
    const dimensionsBefore=await page.evaluate(()=>window.probe.messages.length);await page.setViewportSize({width:width-20,height:800});await flush();
    await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.notify(false);});
    await metric('real viewport change emits one new size',(await page.evaluate(()=>window.probe.messages.length))-dimensionsBefore,1);
    await metric('resize dimensions match the real viewport',await page.evaluate(()=>window.probe.messages.at(-1).message.payload),{width:width-20,height:800});
    const hostBefore=await snapshot();await page.evaluate(()=>window.changeHost());await flush();await page.clock.runFor(30);const hostAfter=await snapshot();
    await metric('replacement host receives one initial viewport',hostAfter.resizes-hostBefore.resizes,1);
    await metric('replacement host does not restart an initialized handshake',hostAfter.ready-hostBefore.ready,0);
    await metric('replacement host owns one active resize observer',hostAfter.activeObservers,1);
    const retiredBefore=await page.evaluate(()=>window.probe.messages.length);await page.evaluate(()=>window.notify(true));
    await metric('retired resize callbacks cannot send to the old host',(await page.evaluate(()=>window.probe.messages.length))-retiredBefore,0);
    const recoveryBefore=await page.evaluate(()=>window.probe.ready.length);await page.evaluate(()=>window.recover());await page.locator('[data-initialized=no]').waitFor();await page.clock.runFor(30);
    await metric('lost initialization requests immediate recovery',(await page.evaluate(()=>window.probe.ready.length))-recoveryBefore,1);
    await metric('recovery uses the current host and callback',await page.evaluate(()=>window.probe.ready.at(-1)),{readyVersion:1,hostVersion:1});
    await page.clock.runFor(1500);await metric('recovery continues its retry cadence',(await page.evaluate(()=>window.probe.ready.length))-recoveryBefore,3);
    await metric('recovery owns exactly one ready interval',await page.evaluate(()=>window.probe.intervals.size),1);
    await page.evaluate(()=>window.initialize());await page.locator('[data-initialized=yes]').waitFor();await flush();
    await metric('recovered initialization stops retry timers again',await page.evaluate(()=>window.probe.intervals.size),0);
    const closedBefore=await snapshot();await page.evaluate(()=>window.dispose());await page.clock.runFor(3000);
    await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.notify(true);});const closedAfter=await snapshot();
    await metric('unmount cancels interval wakes',closedAfter.ticks,closedBefore.ticks);
    await metric('unmount suppresses retained observer callbacks',closedAfter.resizes,closedBefore.resizes);
    await metric('unmount disconnects every resize observer',closedAfter.activeObservers,0);
    await mount(true);await metric('already initialized mount allocates no readiness interval',await page.evaluate(()=>window.probe.intervals.size),0);
    await metric('already initialized mount emits no redundant handshake',await page.evaluate(()=>window.probe.ready.length),0);
    await metric('already initialized mount still reports the initial viewport',await page.evaluate(()=>window.probe.messages.length),1);
    await page.screenshot({path:path.join(output,`initialized-${width}.png`)});
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+reactMode+' '+width+'px game readiness and resize lifetime');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline game readiness regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
