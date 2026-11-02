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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-resolver-failure-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.failResolver=field==='initial';window.calls=0;window.provider={find:()=>{window.calls++;return new Promise(resolve=>{window.resolveMatch=resolve;});}};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('getMatchmaking: () => optionsRef.current.getMatchmaking?.(),','getMatchmaking: () => {if(globalThis.failResolver)throw new Error("lookup failed");return optionsRef.current.getMatchmaking?.();},'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['initial','tick','completion','valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(field=>{window.search=window.testRaceSession.findOpponent(window.provider);window.done=false;window.search.then(()=>{window.done=true;});
  if(field!=='initial'){window.failResolver=field!=='valid';if(field==='tick')window.testRaceSession.tick();window.resolveMatch({status:'success',value:{status:'empty',locale:'en'}});}
 },field);
 await page.waitForFunction(()=>window.done);
 const state=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {stage:s.stage,finding:s.findingOpponent,status:s.matchSearchStatus,error:s.error,calls:window.calls};});
 assert.equal(state.stage,'categories');assert.equal(state.finding,false);assert.equal(state.status,field==='valid'?'empty':'idle');
 if(field!=='valid')assert.equal(state.error,null);assert.equal(state.calls,field==='initial'?0:1);
 assert.deepEqual(errors,[]);console.log('Resolver failure isolation passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
