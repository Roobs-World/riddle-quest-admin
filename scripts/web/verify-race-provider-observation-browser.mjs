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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-provider-observation-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RECOVERY_KEY} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.calls=0;window.armed=true;window.recoveryKey=RACE_RECOVERY_KEY;
window.preview=id=>({challengeId:id,categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:id==='replacement'?'Replacement':'Original'},status:'active',expiresAtMs:Date.now()+60000});
window.replace=()=>{if(window.armed){window.armed=false;window.testRaceSession.enter({ownerId:'owner-2',locale:'en',challengeId:'replacement'});}};
window.value={status:'matched',challenge:window.preview('old-offer')};
if(['match','invalid'].includes(field))Object.defineProperty(window.value,'challenge',{get:()=>{window.replace();return field==='invalid'?{}:window.preview('old-offer');}});
window.empty={status:'empty',locale:'en'};
if(field==='fallback')Object.defineProperty(window.empty,'fallback',{get:()=>{window.replace();return {offerId:'a'.repeat(64),categoryId:'mixed'};}});
if(field==='empty')Object.defineProperty(window.empty,'locale',{get:()=>{window.replace();return 'en';}});
window.result=field==='inherited'?Object.create({get status(){return 'success';},get value(){return window.value;}}):field==='cancelled'?{get status(){window.replace();return 'cancelled';}}:{status:'success',get value(){if(field==='value')window.replace();return ['fallback','empty'].includes(field)?window.empty:window.value;}};
window.provider={find:async()=>{window.calls++;return window.result;}};
if(field==='dispatch')Object.defineProperty(window.provider,'find',{get:()=>{window.replace();return async()=>{window.calls++;return window.result;};}});
window.lookup=()=>window.provider;
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));if(message.type==='game:getRaceEntry')window.releaseEntry=()=>reply(message,'raceEntry',{status:'ready',challenge:window.preview('replacement'),viewerRole:'recipient',serverNowMs:Date.now()});}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('getMatchmaking: () => optionsRef.current.getMatchmaking?.(),','getMatchmaking: () => globalThis.lookup(),'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['dispatch','value','cancelled','match','fallback','empty','invalid','valid','inherited']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(()=>{window.done=false;window.testRaceSession.findOpponent(window.provider).then(()=>{window.done=true;});});
 await page.waitForFunction(()=>window.done);
 const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,id:s.activeChallengeId,finding:s.findingOpponent,pending:s.pending,calls:window.calls};});
 const valid=['valid','inherited'].includes(field);
 assert.equal(state.stage,'challenge');assert.equal(state.finding,false);assert.equal(state.id,valid?'old-offer':'replacement');
 assert.equal(state.calls,field==='dispatch'?0:1);
 if(!valid){
  assert.equal(state.pending,'raceEntry');
  const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.recoveryKey)));
  assert.equal(journal.ownerId,'owner-2');assert.equal(journal.intent.challengeId,'replacement');
  const commands=await page.evaluate(()=>window.commands.filter(m=>m.type==='game:getRaceEntry'));assert.equal(commands.length,1);assert.equal(commands[0].payload.challengeId,'replacement');
  await page.evaluate(()=>window.releaseEntry());await page.getByRole('heading',{name:/Replacement/}).waitFor();
 }else await page.getByRole('heading',{name:/Original/}).waitFor();
 await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Provider observation passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
