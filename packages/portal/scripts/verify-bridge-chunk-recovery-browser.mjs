import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reactMode=process.env.BRIDGE_RECOVERY_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const baseline=process.env.BRIDGE_RECOVERY_BASELINE_DIR;
const serveOnly=process.env.BRIDGE_RECOVERY_SERVE_ONLY==='1';
const output=path.resolve(process.env.BRIDGE_RECOVERY_REPORT_DIR??path.join(root,'../../artifacts/bridge-chunk-recovery-2026-10-03',reactMode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/bridge-recovery-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {BridgeStartupRecovery} from ${JSON.stringify(path.join(root,'src/play/BridgeStartupRecovery.tsx'))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,'src/observability/browserErrorReporter.ts'))};
import {dispatchLocalBridge,GAME_TO_HOST_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={errors:[],paid:0,loads:0,playable:0,unavailable:0,reloads:0,ticks:0,intervals:new Set(),saved:[]};
window.addEventListener('unhandledrejection',event=>window.probe.errors.push({operation:'unhandled',error:String(event.reason)}));
configureBrowserErrorReporter((error,context)=>{window.probe.errors.push({...context,error:String(error)});});
const schedule=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{const id=schedule(()=>{if(delay===750)window.probe.ticks++;callback(...args);},delay);
  if(delay===750)window.probe.intervals.add(id);return id;};
window.clearInterval=id=>{window.probe.intervals.delete(id);clear(id);};
const profile={username:'Alice',coins:300,level:3,xp:420,winStreak:2,gamesPlayed:7,wins:5,achievements:['first_win'],classicIndex:1};
const snapshot={user:{uid:'alice',displayName:'Alice',isAnonymous:false},profile};
const question={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false};
const unexpected=async()=>{window.probe.paid++;throw Error('Unexpected authority mutation');};
const services={products:[],auth:{subscribe(callback){callback(snapshot);return()=>{};}},loadProfile:async()=>profile,
 loadRiddle:async()=>{window.probe.loads++;return question;},completeGame:unexpected,submitGuess:unexpected,requestHint:unexpected,
 spendCoins:unexpected,skipRiddle:unexpected,requestPurchase:unexpected,loadLeaderboard:async()=>[],updateUsername:unexpected,updateAvatar:unexpected,deleteAccount:unexpected};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:update=>window.probe.saved.push(update)});
const root=createRoot(document.querySelector('#root'));
window.component=mode=>root.render(<React.StrictMode><BridgeStartupRecovery reload={()=>{window.probe.reloads++;if(mode==='throw')throw Error('Reload denied');}}/></React.StrictMode>);
window.sendInvalid=()=>dispatchLocalBridge(GAME_TO_HOST_EVENT,{type:'game:ready',payload:{protocolVersion:'invalid'}});
window.sendBurst=()=>{for(let i=0;i<10;i++)dispatchLocalBridge(GAME_TO_HOST_EVENT,{type:'game:resize',payload:{width:390,height:844}});};
if(new URL(location.href).searchParams.has('component'))window.component('noop');
else root.render(<React.StrictMode><PlayHostApp session={session} onPlayable={()=>window.probe.playable++} onStartupUnavailable={()=>window.probe.unavailable++}/></React.StrictMode>);
window.loaded=true;
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},
 plugins:[{name:'bridge-recovery-baseline',enforce:'pre',async load(id){if(!baseline)return;for(const file of ['bridgeRouter','useHostBridgeLifecycle','hostMessageHandlers'])if(id===path.join(root,`src/play/${file}.ts`))return readFile(path.join(baseline,`${file}.before.txt`),'utf8');}}],build:{outDir:'dist',minify:false}});
 const validationAssets=[];for(const file of await readdir(path.join(scratch,'dist/assets')))if(file.endsWith('.js')&&/BridgeProfileSchema\s*=/.test(await readFile(path.join(scratch,'dist/assets',file),'utf8')))validationAssets.push(`/assets/${file}`);
 assert.equal(validationAssets.length,1,'exactly one lazy bridge validation asset');
 let serverFailure=serveOnly;const serverRequests={documents:0,validation:0,failedValidation:0};
 server=createServer(async(request,response)=>{try{const address=new URL(request.url,'http://localhost'),pathname=address.pathname;
 if(serveOnly&&pathname==='/__fixture/failure'){serverFailure=address.searchParams.get('enabled')==='1';response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({serverFailure,...serverRequests}));return;}
 if(pathname==='/')serverRequests.documents++;
 if(validationAssets.includes(pathname)){serverRequests.validation++;if(serverFailure){serverRequests.failedValidation++;response.writeHead(503,{'content-type':'text/javascript'}).end();return;}}
 const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
 const body=await readFile(file);response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(body);}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(Number(process.env.BRIDGE_RECOVERY_BROWSER_PORT??0),'127.0.0.1',resolve));
 if(serveOnly){
  await writeFile(path.join(output,'server.json'),JSON.stringify({url:`http://127.0.0.1:${server.address().port}`,reactMode,validationAssets},null,2));
  await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
 }else{
 browser=await chromium.launch({headless:true});
 const url=`http://127.0.0.1:${server.address().port}`;
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  let fail=true,requests=0,navigations=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.isNavigationRequest())navigations++;});
  await page.route('**/assets/*.js',async route=>{if(validationAssets.includes(new URL(route.request().url()).pathname)){requests++;if(fail){await route.abort('failed');return;}}await route.continue();});
  const metric=async(name,actual,expected)=>{observations.push({width,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  const probe=()=>page.evaluate(()=>({...window.probe,intervals:window.probe.intervals.size}));
  const failed=async()=>{if(!baseline)await page.locator('.bridge-startup-recovery').waitFor();else await page.waitForFunction(()=>window.probe.errors.length>0);};
  const recover=async()=>{if(await page.locator('.bridge-startup-recovery button').count())await page.locator('.bridge-startup-recovery button').click();else await page.reload();};
  await page.goto(url);await page.waitForFunction(()=>window.loaded);await failed();
  await metric('failed startup exposes an accessible recovery alert',await page.locator('.bridge-startup-recovery [role=alert]').count(),1);
  await metric('failed validation download retires the game frame',await page.locator('.game-app').count(),0);
  /* The provider callback runs in a passive effect after the recovery UI commits; allow that commit to finish. */await page.waitForFunction(()=>window.probe.unavailable>=1,undefined,{timeout:5000}).catch(()=>undefined);await metric('failed startup dismisses the provider loading surface exactly once',(await probe()).unavailable,1);
  await metric('recovery does not claim playable content',(await probe()).playable,0);
  await metric('recovery removes readiness retry intervals',(await probe()).intervals,0);
  const before=await probe();await page.clock.install();await page.clock.runFor(3000);await page.evaluate(()=>window.sendBurst());await page.clock.runFor(30);
  const after=await probe();await metric('recovery has no further readiness wakes',after.ticks-before.ticks,0);
  await metric('queued and later messages do not repeat import diagnostics',after.errors.length-before.errors.length,0);
  await metric('the host reports the failed validation load once',after.errors.filter(row=>row.operation==='load_bridge_validation').length,1);
  await metric('failure records a classified startup diagnostic',after.errors.find(row=>row.operation==='load_bridge_validation')?.operation,'load_bridge_validation');
  await metric('failure performs no authority mutation',after.paid,0);await metric('failed validation never starts a riddle request',after.loads,0);
  await metric('failure performs no automatic document navigation',navigations,1);await metric('failure makes one coalesced chunk request',requests,1);
  const text=await page.locator('body').innerText();await metric('recovery hides raw module URLs and error codes',/assets\/|TypeError|bridge-validation-unavailable/.test(text),false);
  if(!baseline){
   const button=page.locator('.bridge-startup-recovery button');const rect=await button.boundingBox();await metric('retry has a 48px touch target',rect.height>=48,true);
   await metric('recovery fits the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(output,`recovery-${width}.png`)});
   await context.setOffline(true);await page.waitForFunction(()=>document.querySelector('.bridge-startup-recovery button').disabled);
   await metric('offline retry is disabled',await button.isDisabled(),true);await page.evaluate(()=>document.querySelector('.bridge-startup-recovery button').click());await page.clock.runFor(100);
   await metric('offline clicks cannot reload',navigations,1);
   await context.setOffline(false);await page.waitForFunction(()=>!document.querySelector('.bridge-startup-recovery button').disabled);
   await metric('online recovery enables retry',await button.isEnabled(),true);
  }
  await recover();await failed();await metric('a still-unavailable reload returns to recovery',await page.locator('.bridge-startup-recovery').count(),1);
  await metric('one explicit retry makes one new document',navigations,2);await metric('a new document makes one new validation attempt',requests,2);
  const waitingNavigations=navigations;await page.clock.runFor(3000);await metric('persistent failures do not loop document reloads',navigations,waitingNavigations);
  fail=false;await recover();await page.getByText(questionText(),{exact:true}).waitFor();
  await metric('restored network and explicit retry recover play',(await probe()).playable,1);await metric('restored play has no unavailable callback',(await probe()).unavailable,0);
  await metric('restored play stops readiness polling',(await probe()).intervals,0);await metric('recovery requires three documents in this two-retry scenario',navigations,3);
  await metric('restored play makes one riddle request',(await probe()).loads,1);await metric('retry preserves authoritative coin balance',await page.evaluate(()=>window.probe.saved.find(row=>row.profile)?.profile.coins),300);
  await metric('retry preserves authoritative completed progress',await page.evaluate(()=>window.probe.saved.find(row=>row.profile)?.profile.gamesPlayed),7);
  await metric('retry never grants or charges coins',(await probe()).paid,0);await page.evaluate(()=>window.sendInvalid());await page.waitForFunction(()=>window.probe.errors.length>0);
  await metric('invalid message data keeps the playable frame',await page.locator('.bridge-startup-recovery').count(),0);
  await metric('invalid message data uses ordinary route diagnostics',(await probe()).errors.at(-1)?.operation,'route_local_message');
  await metric('recovery emits no uncaught browser errors',errors,[]);await context.close();
  const componentContext=await browser.newContext({viewport:{width,height:844}}),componentPage=await componentContext.newPage();
  await componentPage.goto(`${url}?component=1`);await componentPage.locator('.bridge-startup-recovery button').waitFor();
  await componentPage.evaluate(()=>{const button=document.querySelector('button');button.click();button.click();});
  await metric('same-turn clicks request one reload',await componentPage.evaluate(()=>window.probe.reloads),1);
  await metric('accepted reload keeps the action disabled',await componentPage.locator('button').isDisabled(),true);
  await metric('accepted reload exposes its busy state',await componentPage.locator('button').getAttribute('aria-busy'),'true');
  await componentPage.reload();await componentPage.locator('button').waitFor();await componentPage.evaluate(()=>window.component('throw'));await componentPage.locator('button').click();
  await metric('denied reload re-enables the action',await componentPage.locator('button').isEnabled(),true);
  await metric('denied reload removes busy state',await componentPage.locator('button').getAttribute('aria-busy'),null);
  await metric('denied reload is reported safely',await componentPage.evaluate(()=>window.probe.errors.at(-1)?.operation),'reload_bridge_validation');
  await componentPage.locator('button').click();await metric('denied reload remains retryable',await componentPage.evaluate(()=>window.probe.reloads),2);
  await componentContext.close();
 }
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));
 console.log(JSON.stringify({reactMode,baseline:!!baseline,checks:observations.length,failures},null,2));
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
function questionText(){return 'What has keys but cannot open doors?';}
