import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-projected-attempt-rows-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const authority=createFakeRaceServices();window.commands=[];
function reply(message,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace'){if(message.payload.runId!==window.canonical.runId)throw Error('Wrong resume');reply(message,{run:window.canonical});}}
async function mount(){
 let run=JSON.parse(sessionStorage.getItem('canonicalRaceFixture')||'null');
 if(!run){run=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true})).run;
  for(let i=0;i<3;i++)run=(await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:'wrong',requestId:'seed-wrong-'+i})).run;
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
 for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 const runId=await page.evaluate(()=>window.canonical.runId);
 for(const visit of ['cold','reload']){
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.runId),runId);
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed),3);
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().raceGuesses.filter(row=>row.guess.some(Boolean)).length),0);
  assert.equal(await page.locator('.guess-row').count(),5);
  assert.equal(await page.locator('.guess-row').nth(3).locator('[aria-current="true"]').count(),1);
  for(const index of [0,1,2,4])assert.equal(await page.locator('.guess-row').nth(index).locator('.cell:not(:disabled)').count(),0);
  assert.equal(await page.locator('.guess-row').nth(3).locator('.cell:not(:disabled)').count(),5);
  assert.deepEqual(await page.locator('.guess-row').nth(0).locator('.cell').allTextContents(),['','','','','']);
  if(visit==='cold'){
   await page.evaluate(()=>window.testRaceSession.input('text','pa'));
   await page.reload();await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
  }else{
   assert.deepEqual(await page.locator('.guess-row').nth(3).locator('.cell').allTextContents(),['p','a','','','']);
   assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:resumeRace').length),1);
   assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:submitRaceGuess').length),0);
  }
  console.log('Restored attempt rows passed: '+visit+' at '+width+'px.');
 }
 await page.evaluate(()=>{for(let i=0;i<5;i++)window.testRaceSession.input('backspace');window.testRaceSession.input('slot',0);window.testRaceSession.input('text','wrong');});
 await page.getByRole('button',{name:/^Submit/}).click();
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().pending==='raceGuess');
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed),3);
 assert.deepEqual(await page.locator('.guess-row').nth(3).locator('.cell').allTextContents(),[..."wrong"]);
 assert.equal(await page.locator('.guess-row').nth(4).locator('[aria-current="true"]').count(),1);
 for(const index of [0,1,2,3])assert.equal(await page.locator('.guess-row').nth(index).locator('.cell:not(:disabled)').count(),0);
 console.log('Projected attempt rows passed: pending wrong at '+width+'px.');
 await page.evaluate(()=>{const command=window.commands.at(-1);window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:command.requestId,payload:{operation:'raceGuess',ok:false,error:'RaceTo10.ERROR_GENERIC'}}}));});
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().pending===null);
 assert.equal(await page.locator('.guess-row').nth(3).locator('[aria-current="true"]').count(),1);
 assert.deepEqual(await page.locator('.guess-row').nth(3).locator('.cell').allTextContents(),[..."wrong"]);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().raceGuesses.filter(row=>row.guess.some(Boolean)).length),0);
 console.log('Projected attempt rows passed: rollback at '+width+'px.');
 await page.evaluate(()=>window.testRaceSession.retry());
 await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().requiresRunRefresh&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(()=>{for(let i=0;i<5;i++)window.testRaceSession.input('backspace');window.testRaceSession.input('slot',0);window.testRaceSession.input('text',window.canonical.currentRiddle.evaluation.answer);});
 await page.getByRole('button',{name:/^Submit/}).click();
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().run.currentRiddle.position===1);
 assert.equal(await page.locator('.guess-row').nth(0).locator('[aria-current="true"]').count(),1);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed),0);
 console.log('Projected attempt rows passed: correct successor at '+width+'px.');
 assert.deepEqual(errors,[]);await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
