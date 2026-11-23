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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-authority-observation-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RECOVERY_KEY} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.armed=field!=='valid';window.recoveryKey=RACE_RECOVERY_KEY;window.commands=[];
window.preview=()=>({challengeId:'replacement',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Replacement'},status:'active',expiresAtMs:Date.now()+60000});
window.replace=()=>{if(window.armed){window.armed=false;window.testRaceSession.enter({ownerId:'owner-2',locale:'en',challengeId:'replacement'});}};
function reply(message,operation,data){
 const observe=operation==='raceCategories'&&field==='catalog'||operation==='raceStart'&&field==='start'||operation==='raceResume'&&field==='resume'||operation==='raceGuess'&&field==='guess'||operation==='raceHint'&&field==='hint'||operation==='raceSkip'&&field==='skip';
 if(observe){const original=data,key=operation==='raceCategories'?'categories':'run';data={...data};Object.defineProperty(data,key,{enumerable:true,get:()=>{window.replace();return original[key];}});}
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));
 if(observe||field==='valid'&&operation==='raceStart')window.observed=true;
}
function postToHost(message){
 window.commands.push(message);const payload=message.payload;
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace')authority.startRace({...payload,prepare:['start','valid'].includes(field)}).then(data=>reply(message,'raceStart',data));
 if(message.type==='game:resumeRace')authority.resumeRace(payload.runId).then(data=>reply(message,'raceResume',data));
 if(message.type==='game:submitRaceGuess')authority.submitRaceGuess(payload).then(data=>reply(message,'raceGuess',data));
 if(message.type==='game:requestRaceHint')authority.requestRaceHint(payload).then(data=>reply(message,'raceHint',data));
 if(message.type==='game:skipRaceRiddle')authority.skipRaceRiddle(payload).then(data=>reply(message,'raceSkip',data));
 if(message.type==='game:getRaceEntry')window.releaseEntry=()=>reply(message,'raceEntry',{status:'ready',challenge:window.preview(),viewerRole:'recipient',serverNowMs:Date.now()});
}
function mount(){createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);}
if(field==='resume')authority.startRace({locale:'en',categoryId:'mixed',requestId:'resume-fixture',prepare:false}).then(({run})=>{localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));mount();});else mount();
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['catalog','start','resume','guess','hint','skip','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 if(!['catalog','resume'].includes(field)){
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
  await page.evaluate(()=>window.testRaceSession.begin('mixed'));
  if(['guess','hint','skip'].includes(field)){
   await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='racing');
   if(field==='hint')await page.getByRole('button',{name:/^Hint/}).click();
   else if(field==='skip')await page.getByRole('button',{name:/^Skip/}).click();
   else {await page.evaluate(()=>window.testRaceSession.input('text','wrong'));await page.getByRole('button',{name:/^Submit/}).click();}
  }
 }
 try{await page.waitForFunction(()=>window.observed);}catch(error){console.error('Observation diagnostic',field,await page.evaluate(()=>({commands:window.commands,state:window.testRaceSession?.getSnapshot(),active:localStorage.getItem('riddleQuest:activeRaceRun')})),errors);throw error;}
 const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,id:s.activeChallengeId,run:s.run?.runId??null,pending:s.pending,error:s.error};});
 if(field==='valid'){assert(state.run);assert(['countdown','racing'].includes(state.stage));}
 else{
  assert.equal(state.stage,'challenge');assert.equal(state.id,'replacement');assert.equal(state.run,null);assert.equal(state.pending,'raceEntry');assert.equal(state.error,null);
  const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.recoveryKey)));assert.equal(journal.ownerId,'owner-2');assert.equal(journal.intent.challengeId,'replacement');
  assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:getRaceEntry').length),1);
  await page.evaluate(()=>window.releaseEntry());await page.getByRole('heading',{name:/Replacement/}).waitFor();await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);console.log('Authority observation passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
