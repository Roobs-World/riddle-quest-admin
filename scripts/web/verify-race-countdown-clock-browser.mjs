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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-countdown-clock-ownership-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case');
const authority=createFakeRaceServices(),initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'fixture',prepare:true,includeEvaluation:true})).run;
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace')reply(message,'raceStart',{run:initial});
 if(message.type==='game:readyRace'){
  const now=Date.now();window.expectedStart=now+3000;window.readyAt=performance.now();
  reply(message,'raceReady',{run:{...initial,status:'scheduled',serverNowMs:now,startsAtMs:window.expectedStart}});
 }
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['early','late','server','receipt','omitted','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(field=>{const session=window.testRaceSession;session.begin('mixed');const state=session.getSnapshot();
  if(field==='early')state.run.startsAtMs-=10000;if(field==='late')state.run.startsAtMs+=100000;
  if(field==='server')state.run.serverNowMs+=10000;if(field==='receipt')state.receivedAtMs-=10000;
  if(field==='omitted'){delete state.run.startsAtMs;delete state.run.serverNowMs;}
 },field);
 await page.waitForFunction(()=>performance.now()-window.readyAt>=1100);
 const before=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,countdown:s.countdown};});
 assert.equal(before.stage,'countdown');assert([1,2].includes(before.countdown));
 await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
 const after=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,start:s.run.startsAtMs,expected:window.expectedStart,status:s.run.status,wall:s.run.wallElapsedMs,server:s.run.serverNowMs};});
 assert.equal(after.stage,'racing');assert.equal(after.start,after.expected);assert.equal(after.status,'active');assert.equal(after.wall,after.server-after.start);assert(after.wall>=180);
 assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
 console.log('Countdown clock ownership passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
