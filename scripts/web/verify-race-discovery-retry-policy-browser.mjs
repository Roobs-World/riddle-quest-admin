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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-discovery-retry-policy-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
import {raceMatchFailure} from ${JSON.stringify(path.join(root, 'src/core/race'))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.calls=[];window.provider={find:async request=>{window.calls.push(request);if(window.calls.length>1)return {status:'cancelled'};
 if(field==='empty')return {status:'success',value:{status:'empty',locale:'en'}};
 return {status:'retryable-failure',message:'provider',failure:raceMatchFailure(field==='none'?'access-denied':field==='new-intent'?'intent-expired':'temporarily-unavailable',field==='early'?3000:field==='hidden-ready'?1000:0)};
}};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['none','early','new-intent','same-intent','empty','hidden-ready','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(async()=>window.testRaceSession.findOpponent(window.provider));
 await page.evaluate(field=>{const session=window.testRaceSession,state=session.getSnapshot();
  if(field==='none'){state.matchFailure.recovery='same-intent';state.matchRetryReady=true;}
  if(field==='early')state.matchRetryReady=true;
  if(field==='new-intent')state.matchFailure.recovery='same-intent';
  if(field==='same-intent')state.matchFailure.recovery='new-intent';
  if(field==='empty'){state.matchSearchStatus='failed';state.matchFailure={reason:'temporarily-unavailable',recovery:'same-intent',retryAfterMs:0};}
  if(field==='hidden-ready')state.matchRetryReady=false;
  session.reportError(state.error);
 },field);
 if(field==='none'||field==='early'){
  await page.evaluate(()=>window.testRaceSession.retry());assert.equal(await page.evaluate(()=>window.calls.length),1);
  await page.waitForFunction(()=>!window.testRaceSession.getSnapshot().matchRetryReady);
 }else{
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>window.calls.length===2&&!window.testRaceSession.getSnapshot().findingOpponent);
  const requests=await page.evaluate(()=>window.calls);assert.equal(requests[1].requestId===requests[0].requestId,!['new-intent','empty'].includes(field));
 }
 assert.deepEqual(errors,[]);console.log('Discovery retry policy passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
