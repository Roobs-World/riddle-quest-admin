import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const browserScope=process.env.PORTAL_BROWSER_SCOPE;
assert.ok(browserScope===undefined||browserScope==='jest-facebook','PORTAL_BROWSER_SCOPE must be jest-facebook or unset');
const requestedProviders=process.env.RACE_NULL_PROVIDERS?.split(',')??['reddit','firebase'];
const providers=browserScope==='jest-facebook'?requestedProviders.filter(provider=>provider==='firebase'):requestedProviders;
if(browserScope)assert.ok(providers.length>0,'RACE_NULL_PROVIDERS is outside PORTAL_BROWSER_SCOPE');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.RACE_NULL_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.RACE_NULL_REPORT_DIR??path.join(root,'../../builds/test-evidence/race-profile-refresh-null-2026-10-05',mode));
const baseline=process.env.RACE_NULL_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-profile-null-'));
let server,browser;const observations=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostAuthSession} from ${JSON.stringify(path.join(root,'src/play/useHostAuthSession.ts'))};
import {useHostRaceCoordination} from ${JSON.stringify(path.join(root,'src/play/useHostRaceCoordination.ts'))};
${browserScope==='jest-facebook'?'':`import {createRedditHostServices} from ${JSON.stringify(path.join(root,'src/reddit/RedditHostServices.ts'))};`}
import {createFirebaseHostServices} from ${JSON.stringify(path.join(root,'src/play/firebaseServices.ts'))};
const profile={username:'Player',coins:300,xp:0,level:1,gamesPlayed:0,wins:0,winStreak:0,achievements:[],classicIndex:1};
window.probe={requests:[],posts:[],errors:[],unhandled:[],followups:[],replacements:[],failures:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const provider=new URL(location.href).searchParams.get('provider')??${JSON.stringify(browserScope==='jest-facebook'?'firebase':'reddit')};window.newBalance=Number(new URL(location.href).searchParams.get('balance')??777);
let hold=false;const pending=[];const response=result=>({ok:true,json:async()=>({ok:true,result})});
window.fetch=async (url,options)=>{window.probe.requests.push(String(url));if(String(url)!=='/api/game/profile.load')throw new Error('Unexpected fixture gateway route');if(!hold)return response(profile);return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
window.readDocument=async uid=>{window.probe.requests.push('document:'+uid);if(!hold)return profile;return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
const identity=${browserScope==='jest-facebook'?'createFirebaseHostServices()':"provider==='firebase'?createFirebaseHostServices():createRedditHostServices()"};window.pending=()=>pending.length;window.hold=()=>{hold=true;};window.newer=(explicit=false)=>(provider==='firebase'&&!explicit?identity.spendCoins({reason:'continue',requestId:'fixture-spend',amount:25,riddleId:'riddle-1',gameMode:'classic',sessionToken:'owned-session'}):identity.loadProfile(provider==='firebase'?'Alice':'reddit-account')).then(value=>{if(explicit&&value&&typeof value.coins==='number')window.replaceFromExplicit(value);return value;}).catch(error=>window.probe.failures.push(String(error)));window.release=(index,coins)=>pending[index].resolve(provider==='firebase'?{...profile,coins}:response({...profile,coins}));window.fail=index=>pending[index].reject(new Error('Fixture profile transport failed'));
const postToGame=message=>window.probe.posts.push(message);
function App(){const host=useHostAuthSession({services:identity,postToGame});
 const race=useHostRaceCoordination({authSnapshot:host.snapshot,bridgeUser:host.bridgeUser,locale:'en',race:undefined,identity,raceLocalePolicy:'all',applyCoinBalance:host.applyCoinBalance,replaceProfile:(value,owner)=>{window.probe.replacements.push(value);host.replaceProfile(value,owner);},ownsAccount:host.ownsAccount,captureAccount:host.captureAccount,postToGame});
 window.sync=async()=>{const owned=await race.syncProgress({});window.probe.followups.push(owned);return owned;};window.profile=host.snapshot.profile;window.replaceFromExplicit=host.replaceProfile;
 return <><button onClick={()=>{window.hold();void window.sync();}}>Start</button><button onClick={()=>{void window.newer();}}>Refresh</button><output data-balance={host.snapshot.profile?.coins??'missing'}>{host.snapshot.profile?.coins??'missing'}</output></>;}
window.root=createRoot(document.querySelector('#root'));window.root.render(<React.StrictMode><App/></React.StrictMode>);
`);
 const firebaseSource=await readFile(path.join(root,'src/play/firebaseServices.ts'),'utf8');
 const firebaseExports=[...new Set([...firebaseSource.matchAll(/import\s*\{([^}]+)\}\s*from ['"]\.\.\/firebase['"]/g)].flatMap(match=>match[1].split(',').map(name=>name.trim()).filter(name=>name&&!name.startsWith('type ')).map(name=>name.split(/\s+as\s+/)[0])).concat(['auth','loadUserDocument','spendCoins']))];
 const nativeStub=path.join(scratch,'native-auth.ts');await writeFile(nativeStub,"export const onAuthStateChanged=(auth,listener)=>{let live=true;queueMicrotask(()=>{if(live)listener(auth.currentUser);});return()=>{live=false;};};export const signOut=async auth=>{auth.currentUser=null;};");
 await build({root:scratch,configFile:false,resolve:{alias:{'firebase/auth':nativeStub}},publicDir:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'race-null-baseline',enforce:'pre',async load(id){if(browserScope==='jest-facebook')assert.ok(!/(?:\/src\/reddit\/|\/@devvit\/)/u.test(id),'Reddit modules are outside PORTAL_BROWSER_SCOPE');if(id===path.join(root,'src/firebase.ts'))return firebaseExports.map(name=>name==='auth'?"export const auth={currentUser:{uid:'Alice',displayName:'Alice',email:null,photoURL:null,isAnonymous:false,metadata:{creationTime:'2026-01-01T00:00:00.000Z'}}};":name==='loadUserDocument'?"export const loadUserDocument=uid=>window.readDocument(uid);":name==='spendCoins'?"export const spendCoins=async()=>({data:{newCoins:window.newBalance}});":'export const '+name+'=async()=>{throw new Error("Unexpected fixture provider operation");};').join('\n');if(baseline&&id.endsWith('/firebaseServices.ts'))return readFile(path.join(baseline,'firebase.before.txt'),'utf8');if(baseline&&id.endsWith('/useHostRaceCoordination.ts'))return readFile(path.join(baseline,'coordination.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_NULL_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.RACE_NULL_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const provider of providers)for(const balance of [275,777])for(const scenario of process.env.RACE_NULL_SCENARIOS?.split(',')??['superseded','explicit-newer','current','pending-newer','race-reordered','failed-newer','retired']) {
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,provider,balance,scenario,name,actual,expected});
 await page.goto(origin+'?provider='+provider+'&balance='+balance);await page.waitForFunction(()=>window.profile?.coins===300);
 await page.getByRole('button',{name:'Start',exact:true}).click();await page.waitForFunction(()=>window.pending()===1);
 let expectedBalance=balance,followups=[true];
 if(scenario==='current')await page.evaluate(balance=>window.release(0,balance),balance);
 else if(scenario==='retired'){expectedBalance=300;followups=[false];await page.evaluate(()=>{window.root.unmount();window.release(0,300);});}
 else {
  await page.evaluate(scenario=>{if(scenario==='race-reordered')void window.sync();else void window.newer(scenario==='explicit-newer');},scenario);await page.waitForFunction(()=>window.pending()===2);
  if(scenario==='pending-newer'){
   await page.evaluate(()=>window.release(0,300));await page.waitForFunction(()=>window.probe.followups.length===1);
   metric('superseded result cannot clear the current profile while the newest read is pending',await page.locator('output').getAttribute('data-balance'),'300');
   await page.evaluate(balance=>window.release(1,balance),balance);
  } else if(scenario==='failed-newer'){
   expectedBalance=300;await page.evaluate(()=>window.fail(1));await page.waitForTimeout(30);await page.evaluate(()=>window.release(0,300));
  } else {
   if(scenario==='race-reordered')followups=[true,true];
   await page.evaluate(balance=>window.release(1,balance),balance);await page.waitForFunction(balance=>window.profile?.coins===balance,balance);
   metric('newer canonical profile becomes visible',await page.locator('output').getAttribute('data-balance'),String(balance));
   await page.evaluate(()=>window.release(0,300));
  }
 }
 await page.waitForFunction(count=>window.probe.followups.length===count,followups.length);await page.waitForTimeout(30);
 if(scenario==='retired')metric('retired host keeps its surface removed',await page.locator('output').count(),0);
 else metric('optional race refresh retains the latest available canonical profile',await page.locator('output').getAttribute('data-balance'),String(expectedBalance));
 metric('race follow-up never replaces a valid profile with null',await page.evaluate(()=>window.probe.replacements.filter(x=>x===null).length),0);
 metric('current accounts retain follow-up ownership and retired accounts reject it',await page.evaluate(()=>window.probe.followups),followups);
 if(['current','race-reordered'].includes(scenario))metric('current race refresh still applies one valid profile',await page.evaluate(()=>window.probe.replacements.length),1);
 metric('provider transport stays on its injected local seam',await page.evaluate(provider=>window.probe.requests.every(x=>x===(provider==='reddit'?'/api/game/profile.load':'document:Alice')),provider),true);
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external provider traffic',external,[]);await context.close();

 }
 }
} finally {if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_NULL_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Superseded race profile refresh retains current canonical profile');
