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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-history-whitespace-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const params=new URLSearchParams(location.search),kind=params.get('kind'),evaluation=params.get('evaluation')==='true',valid=kind==='internal';window.commands=[];
function reply(message,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace'){
 const run=structuredClone(window.canonical);if(window.recover)run.currentRiddle.confirmedGuesses=[{guess:['x','y'],feedback:['red','red']}];reply(message,{run});
}}
async function mount(){
 const run=(await createFakeRaceServices().startRace({locale:'en',categoryId:'mixed',requestId:'seed-race',prepare:false,includeEvaluation:true})).run;
 const words={'leading-space':[' ','x'],'trailing-space':['x',' '],'leading-nbsp':[' ','x'],'trailing-nbsp':['x',' '],'only-whitespace':[' ',' '],'internal':['x',' ','y']};
 const guess=words[kind],answer=guess.length===3?'abc':'ab';
 Object.assign(run.currentRiddle,{answerLength:guess.length,guessesUsed:1,guessesRemaining:4,evaluation:{answer,locale:'en'}});
 Object.assign(run.preloadedRiddles[0],{answerLength:guess.length,evaluation:{answer,locale:'en'},hint:{index:0,letter:'a'}});
 run.currentRiddle.confirmedGuesses=[{guess,feedback:guess.map(()=>'red')}];if(!evaluation){delete run.preloadedRiddles;delete run.currentRiddle.evaluation;}
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
 for(const width of [1280,390])for(const kind of ['leading-space','trailing-space','leading-nbsp','trailing-nbsp','only-whitespace','internal'])for(const evaluation of [true,false]){
 const valid=kind==='internal';
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?kind='+kind+'&evaluation='+evaluation+'&valid='+valid);
 await page.waitForFunction(()=>window.testRaceSession&&!window.testRaceSession.getSnapshot().pending);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),valid?null:'RaceTo10.ERROR_INVALID_RESPONSE');
 if(!valid){
  assert.deepEqual(await page.evaluate(()=>window.testRaceSession.getSnapshot().raceGuesses),[]);
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run),null);
  await page.getByRole('alert').waitFor({state:'visible'});
  await page.evaluate(()=>{window.recover=true;window.testRaceSession.retry();});
  await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().pending&&window.testRaceSession.getSnapshot().error===null);
 }
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='racing');
 const expected=valid?await page.evaluate(()=>window.canonical.currentRiddle.confirmedGuesses[0].guess.map(letter=>letter.normalize('NFC'))):['x','y'];
 assert.deepEqual((await page.locator('.guess-row').nth(0).locator('.cell').allTextContents()).map(letter=>letter.normalize('NFC')),expected);
 assert.deepEqual(await page.locator('.guess-row').nth(0).locator('.cell').evaluateAll(cells=>cells.map(cell=>cell.classList.contains('red'))),expected.map(()=>true));
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:submitRaceGuess').length),0);
 assert.deepEqual(errors,[]);console.log('History whitespace passed: '+kind+' evaluation='+evaluation+' valid='+valid+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
