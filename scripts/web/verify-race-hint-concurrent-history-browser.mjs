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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-hint-concurrent-history-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const mode='history',returnedHistory=new URLSearchParams(location.search).get('history')==='full',authority=createFakeRaceServices();window.commands=[];
function reply(message,data,operation='raceResume'){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,{run:window.canonical});
 if(message.type==='game:requestRaceHint'){
  const previous=structuredClone(window.canonical.currentRiddle.confirmedGuesses);
  authority.submitRaceGuess({runId:message.payload.runId,riddleId:message.payload.riddleId,guess:'wrong',requestId:'other-tab'}).then(async concurrent=>{
   const hinted=await authority.requestRaceHint(message.payload);
   if(returnedHistory)hinted.run.currentRiddle.confirmedGuesses=[...previous,{guess:concurrent.feedback.map(cell=>cell.letter),feedback:concurrent.feedback.map(cell=>cell.status)}];
   window.canonical=hinted.run;reply(message,hinted,'raceHint');
  });
 }
}
async function mount(){
 let run=JSON.parse(sessionStorage.getItem('canonicalRaceFixture')||'null');
 if(!run){run=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true})).run;
  const rows=[];for(let i=0;i<3;i++){const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:'abbba',requestId:'seed-wrong-'+i});run=result.run;rows.push({guess:result.feedback.map(entry=>entry.letter),feedback:result.feedback.map(entry=>entry.status)});}if(mode==='history')run={...run,currentRiddle:{...run.currentRiddle,confirmedGuesses:rows}};
  sessionStorage.setItem('canonicalRaceFixture',JSON.stringify(run));}
 window.canonical=run;localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
 createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
}mount();
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const history of ['full','legacy']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?history='+history);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 await page.evaluate(()=>{window.testRaceSession.input('text','pa');window.testRaceSession.hint();});
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed===4&&!window.testRaceSession.getSnapshot().pending);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),null);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.totalPenaltyMs),15000);
 for(let index=0;index<3;index++)assert.deepEqual(await page.locator('.guess-row').nth(index).locator('.cell').allTextContents(),[...'abbba']);
 assert.deepEqual(await page.locator('.guess-row').nth(3).locator('.cell').allTextContents(),history==='full'?[...'wrong']:['','','','','']);
 assert.deepEqual(await page.locator('.guess-row').nth(4).locator('.cell').allTextContents(),['p','a','','','']);
 assert.equal(await page.locator('.guess-row').nth(4).locator('[aria-current="true"]').count(),1);
 assert.equal(await page.locator('.guess-row').nth(4).locator('.cell:not(:disabled)').count(),4);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:requestRaceHint').length),1);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:submitRaceGuess').length),0);
 assert.deepEqual(errors,[]);console.log('Concurrent hint history passed: '+history+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
