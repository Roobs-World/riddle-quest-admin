import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.RESIZE_SETUP_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.RESIZE_SETUP_BASELINE_DIR;
const output=path.resolve(process.env.RESIZE_SETUP_REPORT_DIR??path.join(root,'builds/test-evidence/resize-setup-retirement-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/resize-setup-'));
const component=path.join(root,"src/platform/bridge/browser/useGameBridgeLifecycle.ts");
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {useGameReadyReporter} from ${JSON.stringify(component)};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
const scenario=new URL(location.href).searchParams.get('scenario')??'retire';
window.probe={messages:[],listeners:new Set(),observers:[],errors:[],unhandled:[],armed:true};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),NativeObserver=window.ResizeObserver;
window.addEventListener=(type,callback,...args)=>{if(type==='resize')window.probe.listeners.add(callback);return add(type,callback,...args);};
window.removeEventListener=(type,callback,...args)=>{if(type==='resize')window.probe.listeners.delete(callback);return remove(type,callback,...args);};
window.ResizeObserver=class {constructor(callback){this.disconnected=false;this.native=new NativeObserver(callback);window.probe.observers.push(this);}observe(element){this.native.observe(element);}disconnect(){this.disconnected=true;this.native.disconnect();}};
window.snapshot=()=>({game:!!document.querySelector('[data-game]'),version:document.querySelector('[data-game]')?.dataset.version??null,listeners:window.probe.listeners.size,observers:window.probe.observers.filter(x=>!x.disconnected).length,senders:window.probe.messages.map(x=>x.version)});
function Game({version}){const sendReady=React.useCallback(()=>{},[]),post=React.useCallback(message=>{window.probe.messages.push({version,message});if(window.probe.armed&&['retire','remount','replace'].includes(scenario)){window.probe.armed=false;flushSync(()=>scenario==='replace'?window.replace():window.retire());window.probe.afterSend=window.snapshot();}},[version]);useGameReadyReporter({initialized:true,sendReady,postToHost:post});return <output data-game data-version={version}>Game {version}</output>;}
function App(){const [mounted,setMounted]=React.useState(false),[version,setVersion]=React.useState('A'),[epoch,setEpoch]=React.useState(0);window.retire=()=>setMounted(false);window.replace=()=>setVersion('B');window.refresh=()=>setEpoch(x=>x+1);return <div data-epoch={epoch}>{mounted?<Game version={version}/>:<p data-retired>Game removed</p>}<button data-start onClick={()=>setMounted(true)}>Start game</button><button data-stop onClick={()=>setMounted(false)}>Stop game</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'resize-setup-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(path.join(baseline,'bridge.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.RESIZE_SETUP_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.RESIZE_SETUP_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.RESIZE_SETUP_SCENARIOS?.split(',')??['retire','replace','remount','live','stable']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.locator('[data-start]').click();await page.waitForFunction(()=>window.probe.messages.length>0);await page.waitForTimeout(80);
  const retired=scenario==='retire'||scenario==='remount';
  metric('initial viewport belongs to the current game',await page.evaluate(()=>window.probe.messages.map(x=>x.version)),scenario==='replace'?['A','B']:['A']);
  metric('initial viewport uses actual browser geometry',await page.evaluate(()=>window.probe.messages[0].message.payload),{width,height});
  if(['retire','remount','replace'].includes(scenario))metric('host response actually commits removal or replacement',await page.evaluate(()=>({game:window.probe.afterSend.game,version:window.probe.afterSend.version})),scenario==='replace'?{game:true,version:'B'}:{game:false,version:null});
  metric('setup leaves resources only for the current reporter',await page.evaluate(()=>({listeners:window.probe.listeners.size,observers:window.probe.observers.filter(x=>!x.disconnected).length})),{listeners:retired?0:1,observers:retired?0:1});
  if(scenario==='stable'){const before=await page.evaluate(()=>window.probe.observers.length);for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}metric('ordinary parent updates preserve observation',await page.evaluate(()=>window.probe.observers.length),before);}
  if(scenario==='remount'){await page.locator('[data-start]').click();await page.waitForFunction(()=>window.probe.messages.length===2);await page.waitForTimeout(40);metric('remount owns one fresh listener and observer',await page.evaluate(()=>({listeners:window.probe.listeners.size,observers:window.probe.observers.filter(x=>!x.disconnected).length})),{listeners:1,observers:1});}
  await page.locator('[data-stop]').click();await page.waitForTimeout(40);metric('final removal releases every resize resource',await page.evaluate(()=>({listeners:window.probe.listeners.size,observers:window.probe.observers.filter(x=>!x.disconnected).length})),{listeners:0,observers:0});
  const before=await page.evaluate(()=>window.probe.messages.length);await page.setViewportSize({width:width-10,height:height-10});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.waitForTimeout(30);metric('retired callbacks do not emit after viewport change',await page.evaluate(()=>window.probe.messages.length),before);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RESIZE_SETUP_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.RESIZE_SETUP_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Resize setup cannot install resources after synchronous retirement');
