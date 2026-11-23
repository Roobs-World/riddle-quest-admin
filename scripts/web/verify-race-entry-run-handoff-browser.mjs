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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-entry-run-handoff-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/web/fixtures/RetainedRaceHarness.tsx'))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,"src/races/presentation/racePresentation.ts"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const mode=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
const initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'fixture',prepare:true,includeEvaluation:true})).run;
const oldRun={...initial,runId:'old-run',role:'challenger',challengeId:'original',status:'completed',correctCount:10,currentRiddle:null,wallElapsedMs:60000,adjustedElapsedMs:60000,opponent:{displayName:'Nova',adjustedFinishMs:60000,events:[]},events:Array.from({length:10},(_,position)=>({sequence:position,type:'correct',riddlePosition:position,wallElapsedMs:60000,penaltyAddedMs:0,totalPenaltyMs:0,adjustedElapsedMs:60000,correctCount:position+1}))};
const newRun={...initial,runId:'new-run',role:'challenger',challengeId:'different',opponent:{displayName:'Other',adjustedFinishMs:90000,events:[]}},activeRun={...newRun,status:'active'};
window.commands=[];
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:ok?{operation,ok,data}:{operation,ok,error:'RaceTo10.ERROR_GENERIC'}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:getRaceEntry')reply(message,'raceEntry',{status:'ready',challenge:{challengeId:'original',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000},existingRunId:'old-run',serverNowMs:Date.now()});
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:message.payload.runId==='old-run'?oldRun:{...activeRun,...(mode==='identity'?{runId:'foreign-run'}:mode==='opponent'?{opponent:{...activeRun.opponent,adjustedFinishMs:91000}}:{})}});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',projectRaceOutcome(oldRun,60000));
 if(message.type==='game:listRaceInbox')reply(message,'raceInbox',{items:[]});
 if(message.type==='game:startRace')reply(message,'raceStart',{run:newRun});
 if(message.type==='game:readyRace')reply(message,'raceReady',{run:activeRun});
 if(message.type==='game:requestRaceHint')reply(message,'raceHint',null,false);
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" challengeId="original" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-start-selection-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['valid','identity','opponent']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+mode);
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().outcome&&!window.testRaceSession.getSnapshot().pending);
  await page.evaluate(()=>{window.testRaceSession.navigate('inbox');window.testRaceSession.begin('mixed','different');});
  await page.waitForFunction(()=>window.testRaceSession.getSnapshot().run?.runId==='new-run'&&!window.testRaceSession.getSnapshot().pending);
  await page.evaluate(()=>window.testRaceSession.hint());
  await page.waitForFunction(()=>window.testRaceSession.getSnapshot().error&&!window.testRaceSession.getSnapshot().pending);
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  const actual=await page.evaluate(()=>{const state=window.testRaceSession.getSnapshot();return {error:state.error,runId:state.run?.runId,entry:state.entryStatus,challenge:state.challenge};});
  if(mode==='valid')assert.deepEqual(actual,{error:null,runId:'new-run',entry:null,challenge:null});
  else{assert.equal(actual.error,'RaceTo10.ERROR_INVALID_RESPONSE');assert.equal(actual.runId,'new-run');}
  assert.deepEqual(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:resumeRace').map(m=>m.payload.runId)),['old-run','new-run']);
  assert.deepEqual(errors,[]);console.log('Entry run handoff passed: '+mode+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
