import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

// Measures actual Jest startup/commit modules with repeatable provider/backend
// delays. Baseline reproduces the previous app's serial hydration call site.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv.includes('--baseline');
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/jest-startup-load-'));
const output = process.argv.find(arg => arg.endsWith('.json'));
await writeFile(path.join(scratch,'index.html'), '<html lang="en"><body><main id="root">Loading</main><script type="module" src="/main.ts"></script></body></html>');
await writeFile(path.join(scratch,'main.ts'), `
import {startJestSession, markJestPlayable} from ${JSON.stringify(path.join(root,'src/jest/startup.ts'))};
import {commitJestStartupSession} from ${JSON.stringify(path.join(root,'src/jest/commitJestStartupSession.ts'))};
import {MockJestPlatform} from ${JSON.stringify(path.join(root,'src/jest/MockJestPlatform.ts'))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'src/jest/notifications/operationGate.ts'))};
window.events=[];const record=name=>{window.events.push({name,time:performance.now()});};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scenario=new URLSearchParams(location.search).get('scenario');
const registered=scenario!=='guest',urgent=scenario==='urgent';
const platform=new MockJestPlatform(registered);platform.preferences={locale:scenario==='translated'?'tr':'en'};
platform.getPlayerSigned=async()=>{record('signed:start');await wait(80);return {player:platform.player,playerSigned:'signed'};};
platform.getIncompletePurchases=async()=>{record('purchases:start');await wait(80);record('purchases:done');return {status:'success',value:{purchases:urgent?[{purchaseToken:'token',productSku:'sku'}]:[],purchasesSigned:'signed-purchases',hasMore:false}};};
platform.getProfile=async()=>{record('social:start');await wait(200);record('social:done');return null;};
const backend={exchangeIdentity:async()=>{record('identity:start');await wait(220);record('identity:done');return {status:'success',customToken:'token',uid:'uid'};}};
const purchases={reconcile:async()=>{record('recovery:start');if(urgent)await wait(120);record('recovery:done');return {status:'success',value:urgent?1:0};}};
record('startup:start');
const result=await startJestSession(platform,backend,purchases,async()=>{record('auth:start');await wait(60);record('auth:done');});
if(result.status!=='success')throw Error('startup failed');
const gate=createNotificationOperationGate({crossContextLock:null,deletionPending:()=>false,deletionEpoch:()=>null,requireCrossContextLock:false});
let riddle;const preload=()=>{if(!riddle){record('riddle:start');riddle=wait(320).then(()=>record('riddle:done'));}};
const hydrate=async session=>{${baseline ? '' : 'preload();'}record('profile:start');await wait(200);record('profile:done');return {...session,playerData:{schemaVersion:1,updatedAt:Date.now(),profile:{coins:300,level:1,xp:0,winStreak:0,wins:0,gamesPlayed:0,achievements:[],classicIndex:1}}};};
const session=${baseline ? 'await hydrate(result.value)' : 'result.value'};
await commitJestStartupSession({gate,isActive:()=>true,session,${baseline ? '' : 'prepareSession:hydrate,'}enablePlayerStateWrites:()=>record('writes:enabled'),setEngagementProgress:()=>{},setSession:session=>{window.session=session;record('session:mounted');},trackFunnel:()=>{}});
preload();await riddle;
markJestPlayable(platform);document.getElementById('root').innerHTML='<button>Play</button>';record('playable');window.done=true;
`);
let browser,server;
const results=[];
try {
  await build({root:scratch,configFile:false,logLevel:'error',define:{'import.meta.env.VITE_PLATFORM_TARGET':JSON.stringify('jest')},build:{outDir:'dist'},resolve:{alias:{'@qwordly/core/bridge/constants':path.join(root,'../core/src/bridge/constants.ts'),'@qwordly/core/race':path.join(root,'../core/src/race/index.ts')}}});
  server=createServer(async(request,response)=>{
    try {
      const file=path.join(scratch,'dist',new URL(request.url,'http://localhost').pathname==='/'?'index.html':new URL(request.url,'http://localhost').pathname);
      const body=await readFile(file);
      // Returning players download translated namespaces under the same delay.
      if(/\.js$/.test(file)&&!file.endsWith('index.js')&&!path.basename(file).startsWith('index-'))await new Promise(resolve=>setTimeout(resolve,80));
      response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html','cache-control':'no-store'});response.end(body);
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const scenario of ['guest','registered','translated','urgent']){
    const runs=[];
    for(let run=0;run<5;run++){
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/?scenario='+scenario);
      await page.waitForFunction(()=>window.done===true);
      const {events,session}=await page.evaluate(()=>({events:window.events,session:window.session}));
      const time=name=>events.find(event=>event.name===name).time;
      assert.deepEqual(errors,[]);
      assert.ok(time('writes:enabled')>=time('profile:done'),'local progress exposed before the authoritative profile');
      assert.ok(time('playable')>=time('riddle:done'),'loading overlay dismissed before issued content arrived');
      assert.equal(session.playerData.profile.coins,300);
      if(scenario==='urgent')assert.ok(time('identity:start')>=time('recovery:done'),'urgent recovery lost priority');
      if(!baseline&&scenario!=='guest')assert.ok(time('identity:start')<time('social:done'),'identity still waits for social profile');
      if(!baseline)assert.ok(time('riddle:start')<time('profile:done'),'content still waits for server profile');
      runs.push({readyMs:time('playable')-time('startup:start'),events});
      await context.close();
    }
    const medianReadyMs=runs.map(run=>run.readyMs).sort((a,b)=>a-b)[2];
    results.push({scenario,medianReadyMs,runs});console.log(scenario+': '+medianReadyMs.toFixed(1)+'ms');
  }
  if(output)await writeFile(output,JSON.stringify({baseline,conditions:'5 cold browser contexts; 80ms signed player and recovery read; 200ms social and server profiles; 220ms identity; 60ms Firebase auth; 320ms issued content; 80ms translated namespace responses',results},null,2)+'\n');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
