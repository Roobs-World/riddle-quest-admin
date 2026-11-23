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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-confirmed-guess-retention-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const mode='history',historyMode='legacy',probe=new URLSearchParams(location.search).get('probe'),authority=createFakeRaceServices();window.commands=[];
function reply(message,data,operation='raceResume'){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){
  const run=structuredClone(window.canonical);
  if(window.completeRows){run.currentRiddle.confirmedGuesses=structuredClone(window.completeRows);if(probe==='word')run.currentRiddle.confirmedGuesses[3].guess[0]='z';if(probe==='feedback')run.currentRiddle.confirmedGuesses[3].feedback[0]='green';}
  reply(message,{run});
 }
 if(message.type==='game:submitRaceGuess'){
  const previous=structuredClone(window.canonical.currentRiddle.confirmedGuesses);
  authority.submitRaceGuess({runId:message.payload.runId,riddleId:message.payload.riddleId,guess:'anbbb',requestId:'other-tab'}).then(async other=>{
   const result=await authority.submitRaceGuess(message.payload);
   const latest={guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)};window.completeRows=[...previous,{guess:other.feedback.map(cell=>cell.letter),feedback:other.feedback.map(cell=>cell.status)},latest];
   if(historyMode==='full')result.run.currentRiddle.confirmedGuesses=[...previous,{guess:other.feedback.map(cell=>cell.letter),feedback:other.feedback.map(cell=>cell.status)},latest];
   if(historyMode==='partial')result.run.currentRiddle.confirmedGuesses=[latest];
   window.canonical=result.run;reply(message,result,'raceGuess');
  });
 }
}
async function mount(){
 let run=JSON.parse(sessionStorage.getItem('canonicalRaceFixture')||'null');
 if(!run){run=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true})).run;
  const rows=[];for(let i=0;i<2;i++){const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:'abbba',requestId:'seed-wrong-'+i});run=result.run;rows.push({guess:result.feedback.map(entry=>entry.letter),feedback:result.feedback.map(entry=>entry.status)});}if(mode==='history')run={...run,currentRiddle:{...run.currentRiddle,confirmedGuesses:rows}};
  sessionStorage.setItem('canonicalRaceFixture',JSON.stringify(run));}
 window.canonical=run;localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
 createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
}mount();
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const probe of ['word','feedback','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?probe='+probe);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 await page.evaluate(()=>{window.testRaceSession.input('text','wrong');window.testRaceSession.submit();window.testRaceSession.input('text','pa');});
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed===4&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(()=>window.testRaceSession.retry());
 const error=await page.evaluate(()=>window.testRaceSession.getSnapshot().error);
 assert.equal(error,probe==='valid'?null:'RaceTo10.ERROR_INVALID_RESPONSE');
 assert.deepEqual(await page.locator('.guess-row').nth(3).locator('.cell').allTextContents(),[...'wrong']);
 for(let index=0;index<2;index++)assert.deepEqual(await page.locator('.guess-row').nth(index).locator('.cell').allTextContents(),[...'abbba']);
 assert.deepEqual(await page.locator('.guess-row').nth(2).locator('.cell').allTextContents(),probe==='valid'?[...'anbbb']:['','','','','']);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:submitRaceGuess').length),1);
 assert.deepEqual(errors,[]);console.log('Confirmed guess retention passed: '+probe+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
