/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-discovery-callback-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {flushSync} from 'react-dom';import {RACE_RECOVERY_KEY} from ${JSON.stringify(path.join(root, 'src/core/race'))};import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {tr} from ${JSON.stringify(path.join(root,'src/web/play/i18n.ts'))};
window.readRecovery=()=>localStorage.getItem(RACE_RECOVERY_KEY);window.retiredLeaks=[];window.armed=false;window.revocations=0;window.commands=[];window.finds=[];window.label=tr('RaceTo10.MATCH_PLAYER');
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});}
const first={find:request=>{window.finds.push({name:'first',request});return new Promise((resolve,reject)=>{window.completeSearch=kind=>{window.armed=true;
 if(kind==='rejected')return reject(new Error('offline'));
 if(kind==='failure')return resolve({status:'retryable-failure',message:'offline'});
 if(kind==='cancelled')return resolve({status:'cancelled'});
 resolve({status:'success',value:kind==='matched'?{status:'matched',challenge:{challengeId:'delayed-challenge',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000}}:{status:'empty',locale:'en',...(kind==='fallback'?{fallback:{offerId:'a'.repeat(64),categoryId:'mixed'}}:{})}});
 };});}};
const second={find:async request=>{window.finds.push({name:'second',request});return {status:'cancelled'};}};
function App(){const [adapter,setAdapter]=React.useState(first);window.renderedProvider=adapter===first?'first':adapter===second?'replaced':'removed';window.retireDuringNotification=()=>flushSync(()=>setAdapter(window.retireMode==='replaced'?second:undefined));window.changeProvider=mode=>setAdapter(mode==='replaced'?second:undefined);return <RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={adapter} postToHost={postToHost} onClose={()=>{}}/>;}
const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){nativeSetItem.call(this,key,value);if(key===RACE_RECOVERY_KEY&&window.armed&&window.revocations===0){const record=JSON.parse(value);if(record.intent?.kind==='challenge'||record.intent?.failure){window.revocations++;flushSync(()=>window.changeProvider(window.retireMode));}}};
createRoot(document.getElementById('root')).render(<App/>);

`);
let browser,server;
try{
 await build({plugins:[{name:'expose-owned-discovery',enforce:'pre',transform(code,id){if(process.env.RACE_CALLBACK_UNOWNED_BASELINE==='1'&&id.endsWith('/play/race/RaceSession.ts')){const original='const current = () => this.active && generation === this.generation && ownsAdapter();';assert(code.includes(original));return {code:code.replace(original,'const current = () => this.active && generation === this.generation;'),map:null};}if(process.env.RACE_DISCOVERY_UNOWNED_BASELINE==='1'&&id.endsWith('/play/race/RaceSession.ts')){const original='const ownsAdapter = () => !this.options.getMatchmaking || this.options.getMatchmaking() === intent.adapter;';assert(code.includes(original));return {code:code.replace(original,'const ownsAdapter = () => true;'),map:null};}if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current; globalThis.testRaceSession = session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['removed','replaced'])for(const kind of ['matched','fallback','empty','failure']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const label=await page.evaluate(()=>window.label);await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(()=>typeof window.completeSearch==='function');
  await page.evaluate(({mode,kind})=>{window.retireMode=mode;window.testRaceSession.subscribe(()=>{const state=window.testRaceSession.getSnapshot();if(window.renderedProvider!=='first'&&(state.stage==='challenge'||state.error))window.retiredLeaks.push({stage:state.stage,error:state.error});if(kind==='fallback'&&window.armed&&window.revocations===0&&state.matchSearchStatus==='searching'&&!state.findingOpponent){window.revocations++;window.retireDuringNotification();}});}, {mode,kind});
  await page.evaluate(kind=>window.completeSearch(kind),kind);
  await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().findingOpponent);
  assert.equal(await page.evaluate(()=>window.revocations),1,'completion callback did not revoke the adapter');
  assert.equal(await page.evaluate(()=>window.readRecovery()),null,'retired discovery journal survived cleanup');
  const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,challenge:s.challenge,status:s.matchSearchStatus,error:s.error};});
  assert.deepEqual(await page.evaluate(()=>window.retiredLeaks),[],'retired discovery published a challenge or error');
  assert.deepEqual(state,{stage:'categories',challenge:null,status:'idle',error:null});
  assert.deepEqual(await page.evaluate(()=>window.finds.map(find=>find.name)),['first']);
  assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:startRace').length),0);
  if(mode==='replaced'){
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.waitForFunction(()=>window.finds.length===2&&!window.testRaceSession.getSnapshot().findingOpponent);
   assert.deepEqual(await page.evaluate(()=>window.finds.map(find=>find.name)),['first','second']);
   assert.equal(await page.evaluate(()=>window.finds[0].request.requestId===window.finds[1].request.requestId),false);
  }
  assert.deepEqual(errors,[]);console.log('Discovery callback ownership passed: '+mode+' '+kind+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
