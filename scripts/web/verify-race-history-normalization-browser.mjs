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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-history-normalization-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const probe=new URLSearchParams(location.search).get('probe'),echoed=probe==='uppercase'?'À':'a\\u0300';window.commands=[];
function reply(message,data,operation){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){
  const run=structuredClone(window.canonical);
  if(run.currentRiddle.guessesUsed)run.currentRiddle.confirmedGuesses=[{guess:['à'],feedback:['red']}];
  reply(message,{run},'raceResume');
 }
 if(message.type==='game:submitRaceGuess'){
  const run=structuredClone(window.canonical);run.currentRiddle.guessesUsed=1;run.currentRiddle.guessesRemaining=4;
  run.currentRiddle.confirmedGuesses=[{guess:[echoed],feedback:['red']}];window.canonical=run;
  reply(message,{run,isCorrect:false,autoSkipped:false,feedback:[{letter:echoed,status:'red'}]},'raceGuess');
 }
}
async function mount(){
 const run=(await createFakeRaceServices().startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true})).run;
 Object.assign(run.currentRiddle,{answerLength:1,evaluation:{answer:'é',locale:'en'}});
 Object.assign(run.preloadedRiddles[0],{answerLength:1,evaluation:{answer:'é',locale:'en'},hint:{index:0,letter:'é'}});
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
 for(const width of [1280,390])for(const probe of ['uppercase','combining']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?probe='+probe);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 await page.evaluate(()=>{window.testRaceSession.input('text','à');window.testRaceSession.submit();window.testRaceSession.input('text','e');});
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed===1&&!window.testRaceSession.getSnapshot().pending);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),null);
 await page.evaluate(()=>window.testRaceSession.retry());
 await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().pending);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),null);
 assert.deepEqual(await page.locator('.guess-row').nth(0).locator('.cell').allTextContents(),['à']);
 assert.deepEqual(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters),['e']);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:submitRaceGuess').length),1);
 assert.deepEqual(errors,[]);console.log('History normalization passed: '+probe+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
