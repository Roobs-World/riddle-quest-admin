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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-cold-search-retirement-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
import {RACE_RECOVERY_KEY,RACE_RECOVERY_TTL_MS} from ${JSON.stringify(path.join(root, 'src/core/race'))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.calls=[];window.provider={find:async request=>{window.calls.push(request);return {status:'cancelled'};}};
window.currentProvider=field==='available'?window.provider:undefined;window.failResolver=field==='throws';window.newer=field==='newer';window.recoveryKey=RACE_RECOVERY_KEY;
const now=Date.now(),record={version:1,id:'saved-search',ownerId:'owner-1',locale:'en',savedAtMs:now,expiresAtMs:now+RACE_RECOVERY_TTL_MS,intent:{kind:'search',request:{locale:'en',requestId:'old-receipt'}}};
localStorage.setItem(RACE_RECOVERY_KEY,JSON.stringify(record));
window.lookup=()=>{if(window.newer){window.newer=false;localStorage.setItem(RACE_RECOVERY_KEY,JSON.stringify({...record,id:'newer-search'}));}if(window.failResolver)throw new Error('lookup');return window.currentProvider;};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('getMatchmaking: () => optionsRef.current.getMatchmaking?.(),','getMatchmaking: () => globalThis.lookup(),'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['absent','throws','newer','available']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 if(field==='available'){
  await page.waitForFunction(()=>window.calls.length===1&&!window.testRaceSession.getSnapshot().findingOpponent);
  assert.equal(await page.evaluate(()=>window.calls[0].requestId),'old-receipt');
 }else{
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.recoveryKey)));
  assert.equal(record?.id??null,field==='newer'?'newer-search':null);
  assert.equal(await page.evaluate(()=>window.calls.length),0);
  if(field!=='newer'){
   await page.evaluate(()=>{window.failResolver=false;window.currentProvider=window.provider;window.testRaceSession.enter();});
   await page.waitForFunction(()=>window.testRaceSession.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
   assert.equal(await page.evaluate(()=>window.calls.length),0);
   await page.evaluate(async()=>window.testRaceSession.findOpponent(window.provider));
   const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,1);assert.notEqual(calls[0].requestId,'old-receipt');
  }
 }
 assert.deepEqual(errors,[]);console.log('Cold search retirement passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
