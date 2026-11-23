/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-creator-opponent-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case');
const authority=createFakeRaceServices();const initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'authority-fixture',prepare:true,includeEvaluation:true})).run;
const opponent={displayName:'Nova',adjustedFinishMs:60000,events:[]};
window.commands=[];window.injectInvalid=field!=='valid';
if(field==='cold'||field==='valid')localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:initial.runId}));
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace')reply(message,'raceStart',{run:initial});
 if(message.type==='game:readyRace')reply(message,'raceReady',{run:{...initial,status:'active',...(field==='ready'&&window.injectInvalid?{opponent}:{})}});
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:{...initial,...(field==='refresh'?{status:'active'}:{}),...(window.injectInvalid?{opponent}:{})}});
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['cold','ready','refresh','valid']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
  if(field==='ready'||field==='refresh'){
   await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
   await page.evaluate(()=>window.testRaceSession.begin('mixed'));
   if(field==='refresh')await page.evaluate(()=>{window.testRaceSession.getSnapshot().run.opponent={displayName:'Nova',adjustedFinishMs:60000,events:[]};window.testRaceSession.retry();});
  }
  await page.waitForFunction(()=>window.commands.length>0&&window.testRaceSession&&!window.testRaceSession.getSnapshot().pending);
  const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {runId:s.run?.runId??null,error:s.error,opponent:!!s.run?.opponent};});
  if(field==='valid'){assert(state.runId);assert.equal(state.error,null);assert.equal(state.opponent,false);}
  else{
   assert.equal(state.error,'RaceTo10.ERROR_INVALID_RESPONSE');
   if(field==='cold'){assert.equal(state.runId,null);assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:readyRace').length),0);}
   if(field==='ready')assert.equal(state.opponent,false);
   assert.equal(await page.getByRole('alert').count(),1);
   await page.evaluate(()=>{window.injectInvalid=false;window.testRaceSession.retry();});
   await page.waitForFunction(()=>{const s=window.testRaceSession.getSnapshot();return s.run&&!s.pending&&!s.error&&!s.run.opponent;});
  }
  assert.deepEqual(errors,[]);console.log('Creator opponent authority passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
