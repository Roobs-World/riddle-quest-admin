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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-start-origin-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const mode=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
const initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'fixture',prepare:true,includeEvaluation:true})).run;
window.commands=[];const creator=true;window.provider={find:async()=>({status:'success',value:{status:'empty',locale:'en',fallback:{offerId:'a'.repeat(64),categoryId:'mixed'}}})};
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:getRaceEntry')reply(message,'raceEntry',{status:'ready',challenge:{challengeId:'original',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000},viewerRole:'recipient',serverNowMs:Date.now()});
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace'){
  const run={...initial,...(mode.includes('challenge')?{challengeId:'foreign'}:{}),...(mode==='creator-rivalry'||mode==='counter-rivalry'?{rivalryChallengeId:'foreign'}:mode==='valid-counter'?{rivalryChallengeId:'expected-rivalry'}:{}),...(mode==='fallback-challenge'||mode==='valid-fallback'?{role:'challenger',opponent:{displayName:'Nova',adjustedFinishMs:60000,events:[]}}:{})};
  reply(message,'raceStart',{run});
 }
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" challengeId={creator?undefined:'original'} coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-start-selection-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['creator-challenge','creator-rivalry','counter-rivalry','fallback-challenge','valid-counter','valid-fallback','valid-creator']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+mode);
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
  await page.evaluate(async mode=>{const session=window.testRaceSession;if(mode.includes('fallback'))await session.findOpponent(window.provider);else if(mode.includes('counter'))session.rematch('mixed','expected-rivalry');else session.begin('mixed');},mode);
  const actual=await page.evaluate(()=>{const state=window.testRaceSession.getSnapshot();return {runId:state.run?.runId??null,error:state.error,ready:window.commands.filter(m=>m.type==='game:readyRace').length};});
  if(mode.startsWith('valid')){assert(actual.runId);assert.equal(actual.error,null);assert.equal(actual.ready,1);}
  else{assert.deepEqual(actual,{runId:null,error:'RaceTo10.ERROR_INVALID_RESPONSE',ready:0});assert.equal(await page.getByRole('alert').count(),1);}
  assert.deepEqual(errors,[]);console.log('Start origin context passed: '+mode+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
