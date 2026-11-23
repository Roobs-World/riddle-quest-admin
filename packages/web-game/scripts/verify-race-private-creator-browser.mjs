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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-private-creator-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case');window.commands=[];window.recipient=field==='recipient';
window.poisonEntry=session=>{const state=session.getSnapshot(),entry=state.entryStatus;if(entry?.status!=='ready')return;if(field==='clear')state.entryStatus=null;else if(field==='identity')state.activeChallengeId='other';else{entry.viewerRole=field==='recipient'?'creator':'recipient';if(entry.invitation)entry.invitation.role='recipient';}};
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:getRaceEntry')reply(message,'raceEntry',{status:'ready',challenge:{challengeId:'played',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000},...(field==='invitation'?{invitation:{claimState:'unclaimed',publicationState:'published',role:'creator',canCancel:true,expiresAtMs:Date.now()+60000}}:{viewerRole:field==='recipient'?'recipient':'creator'}),serverNowMs:Date.now()});if(message.type==='game:listRaceInbox')reply(message,'raceInbox',{items:[]});}
function App(){return <RaceTo10Game ownerId="owner-1" locale="en" challengeId="played" coins={100} postToHost={postToHost} onClose={()=>{}}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('session.enter(entry);','session.subscribe(()=>window.poisonEntry?.(session));session.enter(entry);'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['viewer','invitation','clear','identity','recipient']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().stage==='challenge'&&!window.testRaceSession.getSnapshot().pending);
  await page.locator('.race-challenge-card .race-primary').click();
  if(field==='recipient'){
   await page.waitForFunction(()=>window.commands.some(message=>message.type==='game:startRace'));
   assert.equal(await page.evaluate(()=>window.commands.find(message=>message.type==='game:startRace').payload.challengeId),'played');
  }else{
   await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='inbox');
   assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:startRace').length),0);
  }
  assert.deepEqual(errors,[]);console.log('Private creator acceptance passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
