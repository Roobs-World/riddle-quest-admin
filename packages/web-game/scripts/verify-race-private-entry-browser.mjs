/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-private-entry-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case');
const authority=createFakeRaceServices();const initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'authority-fixture',prepare:true,includeEvaluation:true})).run;
const run={...initial,role:'challenger',challengeId:'played'};
const response={...run,...(field==='clear'||field==='rewrite'?{challengeId:'other',categoryId:'history'}:{})};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
window.poisonEntry=session=>{const entry=session.getSnapshot().entryStatus;if(field==='pointer'&&entry?.status==='ready')entry.existingRunId='other-run';};
function postToHost(message){window.commands.push(message);if(message.type==='game:getRaceEntry'){
 if(field==='request')window.testRaceSession.getSnapshot().activeChallengeId='other';
 reply(message,'raceEntry',{status:'ready',challenge:{challengeId:field==='request'?'other':'played',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000},viewerRole:'recipient',existingRunId:run.runId,serverNowMs:Date.now()});
 }if(message.type==='game:resumeRace'){
 const state=window.testRaceSession.getSnapshot();if(field==='clear')state.entryStatus=null;if(field==='rewrite'){state.activeChallengeId='other';state.entryStatus.challenge.categoryId='history';}
 reply(message,'raceResume',{run:response});}}
function App(){return <RaceTo10Game ownerId="owner-1" locale="en" challengeId="played" coins={100} postToHost={postToHost} onClose={()=>{}}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('session.enter(entry);','session.subscribe(()=>window.poisonEntry?.(session));session.enter(entry);'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['pointer','clear','rewrite','request','valid']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
  await page.waitForFunction(()=>window.commands.some(message=>message.type==='game:getRaceEntry'));
  await page.waitForFunction(()=>window.testRaceSession.getSnapshot().error||window.testRaceSession.getSnapshot().run);
  const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {runId:s.run?.runId??null,error:s.error};});
  if(field==='valid'||field==='pointer'){assert(state.runId);assert.equal(await page.evaluate(()=>window.commands.find(message=>message.type==='game:resumeRace').payload.runId),state.runId);assert.equal(state.error,null);assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:readyRace').length),1);}
  else{assert.deepEqual(state,{runId:null,error:'RaceTo10.ERROR_INVALID_RESPONSE'});assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:readyRace').length),0);assert.equal(await page.getByRole('alert').count(),1);}
  assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:startRace').length),0);
  assert.deepEqual(errors,[]);console.log('Private entry selection passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
