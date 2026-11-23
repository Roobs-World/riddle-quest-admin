import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.INVITE_COMMIT_REACT_MODE??'development',baseline=process.env.INVITE_COMMIT_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.INVITE_COMMIT_REPORT_DIR??path.join(root,'builds/test-evidence/live-invite-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-invite-commit-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceInviteShare} from ${JSON.stringify(path.join(root,"src/races/components/invitations/LiveRaceInviteShare.tsx"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root,"src/sharing/components/ReferralSharingCapability.tsx"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};import ${JSON.stringify(path.join(root,"src/races/styles/lobby.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const kind=new URL(location.href).searchParams.get('scenario')??'spec-transport';window.probe={shares:[],joins:[],suspended:0,errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
function share(owner,input){window.probe.shares.push({owner,...input});return new Promise((resolve,reject)=>{window.release=()=>{window.release=null;if(kind==='pending-rejection')reject(Error('Injected native dialog rejection'));else resolve(['pending-failure','stable-error','retired-failure','abandoned-failure','committed-retirement','committed-feedback'].includes(kind)?'error':kind==='pending-cancelled'?'cancelled':'success');};});}
function adapter(owner){return {join:async()=>{window.probe.joins.push(owner);throw Error('An invite button cannot join a seat');},update:async()=>{throw Error('An invite button cannot mutate a seat');},shareChallenge:input=>share(owner,input)};}
const adapters={Alice:adapter('Alice'),Bob:adapter('Bob')};
const sharing=Object.fromEntries(['Alice','Bob'].map(owner=>[owner,{rewardCoins:0,shareResult:()=>{},shareInvite:()=>{},shareRace:async()=> 'cancelled',shareLiveRace:input=>share(owner,input)}]));
let unblock;const pending=new Promise(resolve=>unblock=resolve);window.allow=false;function Pending(){window.probe.suspended++;if(!window.allow)throw pending;return null;}
function App(){const [visit,setVisit]=React.useState(0),[mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);const fallback=kind==='spec-fallback',challenge=kind==='spec-challenge'&&visit===1?'b'.repeat(64):'a'.repeat(64),owner=visit===1&&kind!=='spec-challenge'?'Bob':'Alice';
 return <><React.Suspense fallback={<p data-loading>Preparing fixture</p>}><section data-visit={visit} data-epoch={epoch} data-challenge={challenge} data-provider={owner}>{mounted?<ReferralSharingProvider capability={sharing[owner]}><p>Lobby {owner}</p><LiveRaceInviteShare challengeId={challenge} transport={fallback?undefined:adapters[owner]}/></ReferralSharingProvider>:<p data-retired>Invite removed</p>}{visit===1?<Pending/>:null}</section></React.Suspense>
 <button data-prepare onClick={()=>React.startTransition(()=>setVisit(1))}>Prepare replacement</button><button data-commit onClick={()=>{window.allow=true;unblock();}}>Commit replacement</button><button data-abandon onClick={()=>{setVisit(0);window.allow=true;unblock();}}>Abandon replacement</button><button data-release onClick={()=>window.release?.()}>Settle native dialog</button><button data-retire onClick={()=>setMounted(false)}>Retire invitation</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-invite-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/LiveRaceInviteShare.tsx'))return readFile(path.join(baseline,'invite.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.INVITE_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.INVITE_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.INVITE_COMMIT_SCENARIOS?.split(',')??['spec-transport','spec-challenge','spec-fallback','pending-failure','pending-rejection','pending-cancelled','pending-success','committed-retirement','stable-error','retired-failure','abandoned-failure','committed-feedback']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected}),shareButton=page.locator('.live-race-invite-share > button');await page.goto(url+'/?scenario='+scenario);await shareButton.waitFor();
  if(scenario.startsWith('spec-')){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('prepared replacement retains the visible lobby',await page.locator('[data-visit]').getAttribute('data-visit'),'0');await shareButton.click();}
  else{await shareButton.click();await page.waitForFunction(()=>typeof window.release==='function');if(['pending-failure','pending-rejection','pending-cancelled','pending-success','committed-retirement','abandoned-failure'].includes(scenario)){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('pending native dialog keeps the committed lobby visible',await page.locator('[data-visit]').getAttribute('data-visit'),'0');if(scenario==='committed-retirement'){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-visit]')?.dataset.visit==='1');}if(scenario==='abandoned-failure'){await page.locator('[data-abandon]').click();await page.waitForFunction(()=>document.querySelector('[data-visit]')?.dataset.visit==='0');}}}
  metric('native button selects the visible provider and invitation',await page.evaluate(()=>window.probe.shares),[{owner:'Alice',challengeId:'a'.repeat(64)}]);
  metric('one pending native dialog excludes another click',await shareButton.isDisabled(),true);
  if(scenario==='stable-error'){for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('parent updates preserve the native dialog exclusion',await shareButton.isDisabled(),true);metric('parent updates do not open extra native dialogs',await page.evaluate(()=>window.probe.shares.length),1);}
  if(scenario==='retired-failure'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  if(process.env.INVITE_COMMIT_SMOKE!=='1'){
   await page.locator('[data-release]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   metric('failure feedback follows the still-visible invitation owner',await page.locator('.live-race-invite-share [role=alert]').count(),['pending-failure','pending-rejection','stable-error','abandoned-failure','committed-feedback'].includes(scenario)?1:0);
   if(scenario!=='retired-failure'){await page.waitForFunction(()=>!document.querySelector('.live-race-invite-share > button')?.disabled);metric('settled native dialog releases its shared exclusion',await shareButton.isEnabled(),true);}
   if(scenario==='committed-feedback'){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('suspended replacement preserves existing visible failure feedback',await page.locator('.live-race-invite-share [role=alert]').count(),1);}
   if(scenario.startsWith('spec-')||scenario==='committed-feedback'){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-visit]')?.dataset.visit==='1');metric('prepared replacement commits when its dependency settles',await page.locator('[data-visit]').getAttribute('data-visit'),'1');}
   if(scenario==='committed-feedback')metric('committed replacement hides the prior invitation failure',await page.locator('.live-race-invite-share [role=alert]').count(),0);
   if(scenario.startsWith('spec-')||scenario==='committed-retirement'||scenario==='committed-feedback'){await shareButton.click();metric('next native dialog belongs to the committed replacement',await page.evaluate(()=>window.probe.shares.at(-1)),{owner:scenario==='spec-challenge'?'Alice':'Bob',challengeId:(scenario==='spec-challenge'?'b':'a').repeat(64)});await page.locator('[data-release]').click();await page.waitForFunction(()=>!document.querySelector('.live-race-invite-share > button')?.disabled);metric('replacement feedback is independent of the retired dialog',await page.locator('.live-race-invite-share [role=alert]').count(),['committed-retirement','committed-feedback'].includes(scenario)?1:0);}
  }
  metric('sharing does not create a multiplayer seat',await page.evaluate(()=>window.probe.joins),[]);metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.INVITE_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.INVITE_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live invitation committed ownership');
