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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-entry-effect-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
const mode=new URLSearchParams(location.search).get('case');window.commands=[];window.retired=false;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:analytics'&&message.payload.eventName==='race_link_entered'&&!window.retired){
  window.retired=true;
  if(mode==='inbox')window.testRaceSession.navigate('inbox');
  if(mode==='replacement')window.testRaceSession.enter({ownerId:'replacement-owner',locale:'en',challengeId:'replacement'});
  if(mode==='throw')throw new Error('optional analytics unavailable');
 }
 if(message.type==='game:getRaceEntry')reply(message,'raceEntry',{status:'ready',challenge:{challengeId:message.payload.challengeId,categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000},viewerRole:'recipient',existingRunId:message.payload.challengeId+'-run',serverNowMs:Date.now()});
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" challengeId="original" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-entry-effect-session',enforce:'pre',transform(code,id){
  if(process.env.RACE_ENTRY_EFFECT_NEGATIVE_CONTROL==='1'&&id.endsWith('/races/controllers/RaceSession.ts')){
   const guard='this.analytics("race_link_entered");\n        if (!current()) return;';
   assert(code.includes(guard));return {code:code.replace(guard,'this.analytics("race_link_entered");'),map:null};
  }
  if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;
  assert(code.includes('const session = sessionRef.current;'));
  return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};
 }}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['inbox','replacement','throw','control']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+mode);
  await page.waitForFunction(()=>window.retired);
  const snapshot=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,pending:s.pending,challengeId:s.activeChallengeId,resumes:window.commands.filter(m=>m.type==='game:resumeRace').map(m=>m.payload.runId)};});
  if(mode==='inbox')assert.deepEqual({stage:snapshot.stage,pending:snapshot.pending,resumes:snapshot.resumes},{stage:'inbox',pending:'raceInbox',resumes:[]});
  else{assert.equal(snapshot.pending,'raceResume');assert.deepEqual(snapshot.resumes,[mode==='replacement'?'replacement-run':'original-run']);assert.equal(snapshot.challengeId,mode==='replacement'?'replacement':'original');}
  assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:startRace').length),0);
  assert.deepEqual(errors,[]);console.log('Entry effect ownership passed: '+mode+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
