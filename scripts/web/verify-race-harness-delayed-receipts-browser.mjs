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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-harness-delayed-receipts-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const scenario=new URLSearchParams(location.search).get('scenario'),authority=createFakeRaceServices();window.commands=[];
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data:{run:window.canonical}}}}));}
async function mount(){
 const {run}=await authority.startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true});
 if(scenario==='exhausted')for(let i=0;i<4;i++)await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:'wrong',requestId:'previous-'+i});
 const request={runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:scenario==='correct'?'piano':'abbba',requestId:'same-receipt'};
 const results=scenario==='skip'?await Promise.allSettled([authority.skipRaceRiddle(request),authority.skipRaceRiddle(request)]):await Promise.allSettled([authority.submitRaceGuess(request),authority.submitRaceGuess({...request,requestId:scenario==='distinct'?'second-receipt':request.requestId})]);
 if(results.some(result=>result.status!=='fulfilled'))throw Error('Duplicate delivery rejected after advancement');
 if(scenario!=='distinct'&&JSON.stringify(results[0].value)!==JSON.stringify(results[1].value))throw Error('Duplicate delivery changed response');
 let canonical=(await authority.resumeRace(run.runId)).run;
 if(scenario==='wrong'||scenario==='distinct')canonical={...canonical,currentRiddle:{...canonical.currentRiddle,confirmedGuesses:results.slice(0,scenario==='distinct'?2:1).map(result=>({guess:result.value.feedback.map(cell=>cell.letter),feedback:result.value.feedback.map(cell=>cell.status)}))}};
 window.canonical=canonical;localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
 createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
}mount();
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const scenario of ['wrong','correct','exhausted','distinct','skip']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?scenario='+scenario+'&raceGuessDelayMs=10&raceSkipDelayMs=10');
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 const used=scenario==='wrong'?1:scenario==='distinct'?2:0,cleared=used?0:1;
 assert.equal(await page.evaluate(()=>window.canonical.currentRiddle.guessesUsed),used);
 assert.equal(await page.evaluate(()=>window.canonical.correctCount),cleared);
 assert.equal(await page.evaluate(()=>window.canonical.totalPenaltyMs),['exhausted','skip'].includes(scenario)?45000:0);
 assert.equal(await page.locator('.guess-row').nth(used).locator('[aria-current="true"]').count(),1);
 if(used)assert.equal(await page.locator('.keyboard button').filter({hasText:/^A$/}).getAttribute('class'),'key yellow');
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:resumeRace').length),1);
 assert.deepEqual(errors,[]);console.log('Delayed receipt passed: '+scenario+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
