import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.SESSION_RETENTION_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.SESSION_RETENTION_BASELINE_DIR;
const output=path.resolve(process.env.SESSION_RETENTION_REPORT_DIR??path.join(root,'builds/test-evidence/session-assembly-retention-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/session-retention-'));
let browser,server;const observations=[];
try {
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>Session retention fixture</h1><button id="checkout">Check current checkout</button><output id="result"></output></main><script type="module" src="/main.ts"></script></body></html>');
 await writeFile(path.join(scratch,'main.ts'),`
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
window.probe={errors:[],unhandled:[],refreshes:0};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.provider=createFakeHostServices();window.references=[];
window.seed=(count,gated,keepFirst)=>{
 window.uncachedControl=new WeakRef({marker:"uncached"});
 let firstGameplay;
 for(let i=0;i<count;i++){
  const marker={generation:i},purchase=async productId=>({success:true,productId,generation:marker.generation});
  const gate=gated?{open:true,isOpen(){return this.open;},async run(operation){if(!this.open)throw new Error('retired-gate');return operation();},async runExclusive(operation){this.open=false;return operation();}}:undefined;
  const input={hostServices:window.provider,platformPurchase:purchase,accountDeletionServiceGate:gate,raceAvailable:true};
  const session=createHostedPlaySession(input);window.probe.refreshes++;
  window.references.push({purchase:new WeakRef(purchase),commerce:new WeakRef(session.authority.commerce),gate:gate?new WeakRef(gate):null});
  if(i===0){firstGameplay=session.authority.gameplay;if(keepFirst)window.keptSession=session;}
  if(!gated&&session.authority.gameplay!==firstGameplay)throw new Error('gameplay changed during commerce refresh');
  window.currentSession=session;window.currentInput=input;
 }
 window.reused=createHostedPlaySession(window.currentInput).authority===window.currentSession.authority;
};
window.live=()=>({purchases:window.references.filter(x=>x.purchase.deref()).length,commerce:window.references.filter(x=>x.commerce.deref()).length,gates:window.references.filter(x=>x.gate?.deref()).length});
window.checkout=()=>window.currentSession.authority.commerce.requestPurchase('coins');
window.releaseFirst=()=>{window.keptSession=null;};
document.querySelector('#checkout').onclick=async()=>{document.querySelector('#result').textContent=String((await window.checkout()).generation);};
`);
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'session-retention-original',enforce:'pre',async load(id){if(baseline&&id.endsWith('/HostedPlaySession.ts'))return readFile(path.join(baseline,'session.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.SESSION_RETENTION_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const count of process.env.SESSION_RETENTION_QUICK==='1'?[32]:[32,256,1024])for(const scenario of process.env.SESSION_RETENTION_SCENARIOS?.split(',')??['ungated','gated','retained-caller','gated-retained-caller']) {
  const context=await browser.newContext(),page=await context.newPage();const external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({count,scenario,name,actual,expected});
  await page.goto(origin);await page.waitForFunction(()=>typeof window.seed==='function');
  await page.evaluate(({count,scenario})=>window.seed(count,scenario.startsWith('gated'),scenario.endsWith('retained-caller')),{count,scenario});
  const cdp=await context.newCDPSession(page);
  // WeakRef targets remain alive for their creation job. Collect only after that page task ends.
  const kept=scenario.endsWith('retained-caller')?2:1;
  // Under load one GC pair can finish before weak targets are released; repeat across page tasks (a real leak never settles).
  for(let pass=0;pass<5;pass+=1){await cdp.send('HeapProfiler.collectGarbage');await cdp.send('HeapProfiler.collectGarbage');await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));if(await page.evaluate(k=>window.uncachedControl.deref()===undefined&&window.live().purchases<=k,kept))break;}
  metric('uncached control is collectible under the same GC policy',await page.evaluate(()=>window.uncachedControl.deref()===undefined),true);
  metric('obsolete checkout callbacks are collectible while the provider remains active',await page.evaluate(()=>window.live().purchases),kept);
  metric('obsolete commerce wrappers are collectible',await page.evaluate(()=>window.live().commerce),kept);
  metric('retired gate lifetimes are collectible',await page.evaluate(()=>window.live().gates),scenario.startsWith('gated')?kept:0);
  metric('unchanged current authority preserves memoized identity',await page.evaluate(()=>window.reused),true);
  metric('latest checkout still invokes its own callback',await page.evaluate(async()=>await window.checkout()),{success:true,productId:'coins',generation:count-1});
  if(scenario.endsWith('retained-caller')){
   metric('a caller retaining an older session still owns its original checkout',await page.evaluate(async()=>await window.keptSession.authority.commerce.requestPurchase('coins')),{success:true,productId:'coins',generation:0});
   await page.evaluate(()=>window.releaseFirst());await cdp.send('HeapProfiler.collectGarbage');await cdp.send('HeapProfiler.collectGarbage');
   metric('released caller checkout becomes collectible',await page.evaluate(()=>window.live().purchases),1);
   metric('released caller commerce becomes collectible',await page.evaluate(()=>window.live().commerce),1);
   metric('released caller gate becomes collectible',await page.evaluate(()=>window.live().gates),scenario.startsWith('gated')?1:0);
  }
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);metric('no provider traffic',external,[]);
  await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.SESSION_RETENTION_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Obsolete assemblies must not stay rooted by the current provider');
