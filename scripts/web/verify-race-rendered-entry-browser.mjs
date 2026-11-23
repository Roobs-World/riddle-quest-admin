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
const scratch=await mkdtemp(path.join(root,"node_modules/.cache/race-rendered-entry-"));
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,"main.tsx"),`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/fixtures/RetainedRaceHarness.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,"src/web/play/race/logic/racePresentation.ts"))};
const now=Date.now(),run={runId:'old-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,events:[],serverNowMs:now,startsAtMs:now-60000};
const outcome=projectRaceOutcome(run,60000);
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
window.frames=[];window.commands=[];window.capture=false;window.closes=0;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'&&window.currentProps.locale==='en'&&!window.capture)reply(message,'raceResume',{run});
 if(message.type==='game:getRaceOutcome'&&!window.capture)reply(message,'raceOutcome',outcome);
}
const tournaments={record:async()=>({}),list:()=>new Promise(()=>{})};
function App(){const [props,setProps]=React.useState({ownerId:'owner-1',locale:'en',coins:100});window.currentProps=props;
 window.changeEntry=mode=>{window.oldSession=globalThis.testRaceSession;window.capture=true;window.frames=[];
  setProps(current=>({...current,...(mode==='locale'?{locale:'fr'}:mode==='challenge'?{challengeId:'new-challenge'}:mode==='inbox'?{openInbox:true}:mode==='tournament'?{tournamentLocale:'en'}:mode==='account'?{ownerId:'owner-2'}:mode==='coins'?{coins:200}:{initialCategories:[]})}));};
 React.useLayoutEffect(()=>{if(window.capture){const state=globalThis.testRaceSession.getSnapshot();window.frames.push({runId:state.run?.runId??null,outcomeId:state.outcome?.runId??null,resultVisible:Boolean(document.querySelector('.race-result')),sameSession:window.oldSession===globalThis.testRaceSession});}});
 return <RaceTo10Game {...props} tournaments={tournaments} postToHost={postToHost} onClose={()=>{window.closes++;}}/>;}
const app=<App/>;window.root=createRoot(document.getElementById('root'));window.root.render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser,server;const failures=[];
try{
 await build({root:scratch,configFile:false,logLevel:"error",plugins:[{name:"expose-session",transform(code,id){
  if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;
  assert(code.includes('const session = sessionRef.current;'));
  return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current; globalThis.testRaceSession = session;'),map:null};
 }}],build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{
  const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
  response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));
 }catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const strict of [false,true])for(const width of [1280,390])for(const scenario of ['locale','challenge','inbox','tournament','account','coins','catalog']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?strict='+strict);
   await page.waitForFunction(()=>globalThis.testRaceSession?.getConfirmedOutcomeRunId()==='old-run');
   await page.evaluate(mode=>window.changeEntry(mode),scenario);
   await page.waitForFunction(()=>window.frames.length>0);
   const frames=await page.evaluate(()=>window.frames),preserve=['coins','catalog'].includes(scenario);
   assert.ok(frames.every(frame=>preserve?frame.sameSession&&frame.runId==='old-run'&&frame.outcomeId==='old-run':!frame.sameSession&&frame.runId===null&&frame.outcomeId===null&&!frame.resultVisible),'committed replacement retained the previous journey: '+JSON.stringify(frames));
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   if(!preserve){
    const before=await page.evaluate(()=>window.commands.length);
    await page.evaluate(()=>{window.oldSession.reportError('RaceTo10.ERROR_GENERIC');window.oldSession.requestClose();window.oldSession.navigate('inbox');});
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().error),null,'retired session contaminated current errors');
    assert.equal(await page.evaluate(()=>window.closes),0,'retired session closed the replacement surface');
    assert.equal(await page.evaluate(()=>window.commands.length),before,'retired session issued a command');
   }
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>window.commands.filter(message=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:publishRace','game:abandonRace'].includes(message.type)).length),0);
   console.log('Rendered entry passed: '+scenario+' at '+width+'px, strict='+strict+'.');
  }catch(error){failures.push({scenario,width,strict,message:error.message});console.error('Rendered entry FAILED: '+JSON.stringify(failures.at(-1)));}
  finally{await context.close();}
 }
 assert.deepEqual(failures,[],JSON.stringify(failures));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
