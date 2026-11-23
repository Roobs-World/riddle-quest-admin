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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-history-progression-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const params=new URLSearchParams(location.search),probe=params.get('probe'),evaluation=params.get('evaluation')==='modern',solved=params.get('solved')==='true',authority=createFakeRaceServices();window.commands=[];
function reply(message,data,operation){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){
  const run=structuredClone(window.canonical);
  if(probe==='cold'&&solved&&!window.recover)run.currentRiddle.confirmedGuesses[0].feedback.fill('green');
  reply(message,{run},'raceResume');
 }
 if(message.type==='game:requestRaceHint'){
  authority.submitRaceGuess({runId:message.payload.runId,riddleId:message.payload.riddleId,guess:'zzzzz',requestId:'other-tab'}).then(async guess=>{
   const result=await authority.requestRaceHint(message.payload);
   result.run.currentRiddle.confirmedGuesses=[{guess:guess.feedback.map(cell=>cell.letter),feedback:guess.feedback.map(cell=>cell.status)}];
   window.canonical=structuredClone(result.run);
   if(solved)result.run.currentRiddle.confirmedGuesses[0].feedback.fill('green');
   reply(message,result,'raceHint');
  });
 }
}
async function mount(){
 let run=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:evaluation})).run;
 if(probe==='cold'){
  const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:'zzzzz',requestId:'seed-wrong'});run=result.run;
  run.currentRiddle.confirmedGuesses=[{guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)}];
 }
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
 for(const width of [1280,390])for(const probe of ['cold','paid'])for(const evaluation of (probe==='cold'?['modern','legacy']:['modern']))for(const solved of [true,false]){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?probe='+probe+'&evaluation='+evaluation+'&solved='+solved);
 if(probe==='paid'){
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
  await page.evaluate(()=>{window.testRaceSession.input('text','pi');window.testRaceSession.hint();});
 }
 await page.waitForFunction(()=>window.testRaceSession&&!window.testRaceSession.getSnapshot().pending);
 const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {error:s.error,used:s.run?.currentRiddle?.guessesUsed,penalty:s.run?.totalPenaltyMs,letters:s.currentLetters,history:s.raceGuesses};});
 assert.equal(state.error,solved?'RaceTo10.ERROR_INVALID_RESPONSE':null);
 if(solved){
  assert.deepEqual(state.history,[]);if(probe==='paid'){assert.equal(state.used,0);assert.equal(state.penalty,0);assert.deepEqual(state.letters,['p','i','','','']);}
  await page.getByRole('alert').waitFor({state:'visible'});
  await page.evaluate(()=>{window.recover=true;window.testRaceSession.retry();});
  await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().pending&&window.testRaceSession.getSnapshot().error===null);
 }
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='racing');
 assert.deepEqual(await page.locator('.guess-row').nth(0).locator('.cell').allTextContents(),[...'zzzzz']);
 assert.deepEqual(await page.locator('.guess-row').nth(0).locator('.cell').evaluateAll(cells=>cells.map(cell=>cell.classList.contains('red'))),[true,true,true,true,true]);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:requestRaceHint').length),probe==='paid'?1:0);
 assert.deepEqual(errors,[]);console.log('History progression passed: '+probe+' '+evaluation+' solved='+solved+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
