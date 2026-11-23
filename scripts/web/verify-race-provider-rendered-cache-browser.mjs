/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
await mkdir(path.join(root,"node_modules/.cache"),{recursive:true});
const scratch=await mkdtemp(path.join(root,"node_modules/.cache/race-provider-cache-"));
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,"main.tsx"),`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,"src/races/presentation/racePresentation.ts"))};
const now=Date.now(),run={runId:'owned-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,events:[],serverNowMs:now,startsAtMs:now-60000};
if(new URLSearchParams(location.search).get('active')==='true')Object.assign(run,{status:'active',correctCount:0,wallElapsedMs:1000,adjustedElapsedMs:1000,startsAtMs:now-1000,
 currentRiddle:{riddleId:'question-0',text:'A clue',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]}});
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
window.frames=[];window.commands=[];window.reads=[];window.recordings=[];window.capture=false;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',projectRaceOutcome(run,60000));
 if(message.type==='game:listRaceInbox')reply(message,'raceInbox',{items:[]});
}
const adapter=name=>({record:runId=>{window.recordings.push({name,runId});return new Promise(()=>{});},list:()=>new Promise((resolve,reject)=>window.reads.push({name,resolve,reject}))});
const first=adapter('first'),second=adapter('second');
window.finishRead=(index,rank)=>window.reads[index].resolve({tournamentId:'daily',contextId:'room',locale:'en',startsAtMs:now,endsAtMs:now+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[{rank,adjustedTimeMs:60000,isCurrentPlayer:true}]});
function App(){const [provider,setProvider]=React.useState(first);window.replaceProvider=()=>{window.oldSession=globalThis.testRaceSession;window.frames=[];window.capture=true;setProvider(second);};
 React.useLayoutEffect(()=>{if(window.capture)window.frames.push({rank:document.querySelector('li[aria-current="true"] strong')?.textContent??null,sameSession:window.oldSession===globalThis.testRaceSession});});
 return <RaceTo10Game ownerId="owner-1" locale="en" coins={100} tournaments={provider} contextBoard={provider} postToHost={postToHost} onClose={()=>{}}/>;}
const app=<App/>;createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser,server;const failures=[];
try{
 await build({root:scratch,configFile:false,logLevel:"error",plugins:[{name:"expose-session",transform(code,id){
  if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;
  assert(code.includes('const session = sessionRef.current;'));
  return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current; globalThis.testRaceSession = session;'),map:null};
 }}],build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{
  const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
  response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));
 }catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const strict of [false,true])for(const width of [1280,390])for(const stage of ['tournaments','inbox'])for(const ending of ['cached','pending-success','pending-failure']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?strict='+strict);
   await page.waitForFunction(()=>globalThis.testRaceSession?.getConfirmedOutcomeRunId()==='owned-run');
   await page.evaluate(stage=>globalThis.testRaceSession.navigate(stage),stage);
   await page.waitForFunction(()=>window.reads.length===1);
   await page.evaluate(()=>window.finishRead(0,9));
   await page.waitForFunction(()=>document.querySelector('li[aria-current="true"] strong')?.textContent==='#9');
   if(ending!=='cached'){
    await page.getByRole('tab',{name:stage==='tournaments'?'Tournaments':'Activity',exact:true}).click();
    await page.waitForFunction(()=>window.reads.length===2);
   }
   const newRead=ending==='cached'?1:2;
   await page.evaluate(()=>window.replaceProvider());
   await page.waitForFunction(index=>window.frames.length>0&&window.reads.length===index+1,newRead);
   const frames=await page.evaluate(()=>window.frames);
   assert.ok(frames.every(frame=>frame.rank===null&&frame.sameSession),'replacement frame exposed retired provider standings or reset competitive session: '+JSON.stringify(frames));
   await page.evaluate(index=>window.finishRead(index,1),newRead);
   await page.waitForFunction(()=>document.querySelector('li[aria-current="true"] strong')?.textContent==='#1');
   if(ending!=='cached')await page.evaluate(ending=>{if(ending==='pending-success')window.finishRead(1,9);else window.reads[1].reject(new Error('retired-provider-error'));},ending);
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   assert.equal(await page.locator('li[aria-current="true"] strong').textContent(),'#1');
   assert.equal(await page.getByRole('alert').count(),0);
   assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getConfirmedOutcomeRunId()),'owned-run');
   assert.equal(await page.evaluate(()=>window.commands.filter(message=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:publishRace','game:abandonRace'].includes(message.type)).length),0);
   assert.deepEqual(errors,[]);
   console.log('Provider rendered cache passed: '+stage+' '+ending+' at '+width+'px, strict='+strict+'.');
  }catch(error){failures.push({stage,ending,width,strict,message:error.message});console.error('Provider rendered cache FAILED: '+JSON.stringify(failures.at(-1)));}
  finally{await context.close();}
 }
 for(const strict of [false,true])for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?active=true&strict='+strict);
   await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='racing'&&globalThis.testRaceSession.getSnapshot().pending===null);
   await page.evaluate(()=>{globalThis.testRaceSession.input('text','APPLE');window.replaceProvider();});
   await page.waitForFunction(()=>window.frames.length>0);
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   assert.equal(await page.evaluate(()=>window.oldSession===globalThis.testRaceSession),true,'provider replacement reset active session');
   assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE','provider replacement lost typed answer');
   assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().run.runId),'owned-run');
   assert.equal(await page.evaluate(()=>window.reads.length),0,'provider replacement issued a read during gameplay');
   assert.equal(await page.evaluate(()=>window.commands.filter(message=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:publishRace','game:abandonRace'].includes(message.type)).length),0);
   assert.deepEqual(errors,[]);console.log('Provider replacement preserves active input at '+width+'px, strict='+strict+'.');
  }catch(error){failures.push({stage:'racing',width,strict,message:error.message});console.error('Provider rendered cache FAILED: '+JSON.stringify(failures.at(-1)));}
  finally{await context.close();}
 }
 assert.deepEqual(failures,[],JSON.stringify(failures));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
