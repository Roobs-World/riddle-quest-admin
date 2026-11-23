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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-delivery-expiry-ownership-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RECOVERY_KEY} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.armed=false;window.phase='';window.commands=[];window.timers=new Set();window.recoveryKey=RACE_RECOVERY_KEY;window.receiptSequence=0;
window.notify=phase=>{if(window.armed&&window.phase===phase){window.armed=false;window.testRaceSession.enter({ownerId:'owner-2',locale:'en',challengeId:'replacement'});}};
window.cancelled=[];window.testClock={now:()=>performance.now(),schedule:(callback,delay)=>{const id=setTimeout(()=>{window.timers.delete(id);callback();},delay);window.timers.add(id);if(window.armed){window.armed=false;clearTimeout(id);window.timers.delete(id);callback();}return id;},cancel:id=>{window.cancelled.push(id);clearTimeout(id);window.timers.delete(id);}};
window.testReceipt=operation=>{const id=operation+'-'+(++window.receiptSequence);window.notify('receipt');return id;};
window.preview=()=>({challengeId:'replacement',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Replacement'},status:'active',expiresAtMs:Date.now()+60000});
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')window.releaseCatalog=()=>authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));if(message.type==='game:listRaceInbox')window.releaseInbox=()=>reply(message,'raceInbox',{items:[]});if(message.type==='game:getRaceEntry')window.releaseEntry=()=>reply(message,'raceEntry',{status:'ready',challenge:window.preview(),viewerRole:'recipient',serverNowMs:Date.now()});}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('postToHost: message => optionsRef.current.postToHost(message),','clock: globalThis.testClock, requestId: globalThis.testReceipt, postToHost: message => optionsRef.current.postToHost(message),').replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['handled','replacement','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.releaseCatalog);
 await page.evaluate(async()=>window.releaseCatalog());
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(field=>{
  window.cancelled=[];window.armed=field!=='valid';
  if(field==='replacement')window.unsubscribe=window.testRaceSession.subscribe(()=>{if(window.testRaceSession.getSnapshot().error&&!window.replaced){window.replaced=true;window.testRaceSession.enter({ownerId:'owner-2',locale:'en',challengeId:'replacement'});}});
  window.testRaceSession.navigate('inbox');
 },field);
 if(field==='valid'){
  assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:listRaceInbox').length),1);
  assert.equal(await page.evaluate(()=>window.timers.size),1);
  await page.evaluate(()=>window.releaseInbox());
  assert.equal(await page.evaluate(()=>window.timers.size),0);
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),null);
 }else{
  assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:listRaceInbox').length),0);
  assert.equal(await page.evaluate(()=>window.cancelled.length),0);
  if(field==='replacement'){
   await page.evaluate(()=>window.unsubscribe());
   const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,id:s.activeChallengeId,pending:s.pending,run:s.run,error:s.error};});
   assert.deepEqual(state,{stage:'challenge',id:'replacement',pending:'raceEntry',run:null,error:null});
   assert.equal(await page.evaluate(()=>window.timers.size),1);
   const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.recoveryKey)));assert.equal(journal.ownerId,'owner-2');assert.equal(journal.intent.challengeId,'replacement');
   await page.evaluate(()=>window.releaseEntry());await page.getByRole('heading',{name:/Replacement/}).waitFor();await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
  }else{
   assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().pending),null);
   assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().error),'RaceTo10.ERROR_GENERIC');
   await page.getByRole('alert').waitFor();
  }
  assert.equal(await page.evaluate(()=>window.timers.size),0);
 }
 assert.deepEqual(errors,[]);console.log('Delivery expiry ownership passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
