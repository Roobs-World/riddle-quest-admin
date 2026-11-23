import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-history-continuity-audit-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/web/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const mode='history',authority=createFakeRaceServices();window.commands=[];
function reply(message,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace'){if(message.payload.runId!==window.canonical.runId)throw Error('Wrong resume');reply(message,{run:window.canonical});}}
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
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const observations=[];
 for(const width of [1280,390])for(const mutation of ['word','feedback','shortened','omitted','append','unchanged']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='racing');
 await page.evaluate(mutation=>{
   const prompt=window.canonical.currentRiddle;
   if(mutation==='word')prompt.confirmedGuesses[0].guess[1]='z';
   if(mutation==='feedback')prompt.confirmedGuesses[0].feedback[0]='red';
   if(mutation==='shortened')prompt.confirmedGuesses=prompt.confirmedGuesses.slice(1);
   if(mutation==='omitted')delete prompt.confirmedGuesses;
   if(mutation==='append'){prompt.confirmedGuesses.push(structuredClone(prompt.confirmedGuesses[0]));prompt.guessesUsed=4;prompt.guessesRemaining=1;}
   window.testRaceSession.retry();
 },mutation);
 const snapshot=await page.evaluate(()=>{const state=window.testRaceSession.getSnapshot();return {error:state.error,history:state.run.currentRiddle.confirmedGuesses,used:state.run.currentRiddle.guessesUsed};});
 const invalid=['word','feedback'].includes(mutation);
 const expected=invalid?'reject changed confirmed history':mutation==='shortened'||mutation==='omitted'?'retain three confirmed rows':'accept compatible history';
 const passed=invalid?snapshot.error==='RaceTo10.ERROR_INVALID_RESPONSE':(snapshot.error===null&&(snapshot.history?.length===(mutation==='append'?4:3)));
 observations.push({width,mutation,expected,passed,snapshot});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(observations.at(-1)));await context.close();
 }
 console.log(JSON.stringify({cases:observations.length,failed:observations.filter(item=>!item.passed).length}));
 if(observations.some(item=>!item.passed))process.exitCode=1;

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
