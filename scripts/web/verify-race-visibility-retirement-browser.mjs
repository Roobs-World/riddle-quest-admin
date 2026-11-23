/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const reactRuntime=process.env.RACE_REACT_DEVELOPMENT==='1'?'development':'production';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-visibility-retirement-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {tr} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
window.sessionSetups=0;window.sessionCleanups=0;window.suspended=false;window.tickCalls=0;window.gameVisible=true;
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.gameVisible?'visible':'hidden'});
const nativeInterval=window.setInterval.bind(window);
window.setInterval=(callback,delay,...args)=>nativeInterval(delay===50?()=>{if(!window.suspended){window.tickCalls++;callback(...args);}}:callback,delay,...args);
window.hideGame=()=>{window.suspended=true;window.gameVisible=false;document.dispatchEvent(new Event('visibilitychange'));};
window.showGame=()=>{window.gameVisible=true;document.dispatchEvent(new Event('visibilitychange'));};
window.commands=[];window.finds=[];window.label=tr('RaceTo10.MATCH_PLAYER');
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});}
const first={find:request=>{window.finds.push({name:'first',request});return new Promise((resolve,reject)=>{window.completeSearch=kind=>{
 if(kind==='rejected')return reject(new Error('offline'));
 if(kind==='failure')return resolve({status:'retryable-failure',message:'offline'});
 if(kind==='cancelled')return resolve({status:'cancelled'});
 resolve({status:'success',value:kind==='matched'?{status:'matched',challenge:{challengeId:'delayed-challenge',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000}}:{status:'empty',locale:'en',...(kind==='fallback'?{fallback:{offerId:'a'.repeat(64),categoryId:'mixed'}}:{})}});
 };});}};
const second={find:async request=>{window.finds.push({name:'second',request});return {status:'cancelled'};}};
function App(){const [adapter,setAdapter]=React.useState(first);window.renderedProvider=adapter===first?'first':adapter===second?'replaced':'removed';window.changeProvider=mode=>setAdapter(mode==='same'?first:mode==='replaced'?second:undefined);return <RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={adapter} postToHost={postToHost} onClose={()=>{}}/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-owned-discovery',enforce:'pre',transform(code,id){if(process.env.RACE_VISIBILITY_BASELINE==='1'&&id.endsWith('/races/controllers/RaceSession.ts')){const original='if (visible) this.tick();';assert(code.includes(original));return {code:code.replace(original,''),map:null};}if(process.env.RACE_DISCOVERY_UNOWNED_BASELINE==='1'&&id.endsWith('/races/controllers/RaceSession.ts')){const original='const ownsAdapter = () => !this.options.getMatchmaking || this.options.getMatchmaking() === intent.adapter;';assert(code.includes(original));return {code:code.replace(original,'const ownsAdapter = () => true;'),map:null};}if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current; globalThis.testRaceSession = session;').replace('session.enter(entry);','window.sessionSetups++;session.enter(entry);').replace('return () => {session.dispose();','return () => {window.sessionCleanups++;session.dispose();'),map:null};}}],root:scratch,configFile:false,define:{'process.env.NODE_ENV':JSON.stringify(reactRuntime)},logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['removed','replaced','same'])for(const kind of ['pending','empty','failure']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.sessionSetups>0);
  assert.deepEqual(await page.evaluate(()=>[window.sessionSetups,window.sessionCleanups]),reactRuntime==='development'?[2,1]:[1,0],'React effect replay count did not match selected runtime');
  const label=await page.evaluate(()=>window.label);await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(()=>typeof window.completeSearch==='function');
  if(kind!=='pending'){
   await page.evaluate(kind=>window.completeSearch(kind),kind);
   await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().findingOpponent);
  }
  await page.evaluate(()=>window.hideGame());
  const calls=await page.evaluate(()=>window.tickCalls);
  await page.evaluate(mode=>window.changeProvider(mode),mode);
  await page.waitForFunction(mode=>window.renderedProvider===(mode==='same'?'first':mode),mode);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,100)));
  assert.equal(await page.evaluate(()=>window.tickCalls),calls,'gameplay interval ran while suspended');
  const original=kind==='pending'?'searching':kind==='failure'?'failed':'empty';
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().matchSearchStatus),original);
  await page.evaluate(()=>window.showGame());
  if(mode==='same'){
   assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().matchSearchStatus),original,'visibility cancelled a current provider');
   if(kind==='pending'){await page.evaluate(()=>window.completeSearch('matched'));await page.waitForFunction(()=>window.testRaceSession.getSnapshot().matchSearchStatus==='matched');}
  }else{
   await page.waitForFunction(()=>window.testRaceSession.getSnapshot().matchSearchStatus==='idle',undefined,{timeout:1500});
   assert.equal(await page.evaluate(()=>window.tickCalls),calls,'retirement was serviced by an interval instead of visibility');
   const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,challenge:s.challenge,status:s.matchSearchStatus,error:s.error};});
   assert.deepEqual(state,{stage:'categories',challenge:null,status:'idle',error:null});
   if(kind==='pending'){await page.evaluate(()=>window.completeSearch('matched'));await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,50)));assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().matchSearchStatus),'idle');}
   assert.deepEqual(await page.evaluate(()=>window.finds.map(find=>find.name)),['first']);
  }
  assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:startRace').length),0);
  assert.deepEqual(errors,[]);console.log('Visibility retirement passed: '+reactRuntime+' '+mode+' '+kind+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
