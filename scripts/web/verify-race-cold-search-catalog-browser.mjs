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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-cold-search-catalog-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {raceMatchFailure} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/web/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
import {RACE_RECOVERY_KEY,RACE_RECOVERY_TTL_MS} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
const field=new URLSearchParams(location.search).get('case'),authority=createFakeRaceServices();
window.calls=[];window.provider={find:async request=>{window.calls.push(request);if(field==='retired'){window.currentProvider=undefined;return {status:'cancelled'};}if(field==='empty')return {status:'success',value:{status:'empty',locale:'en'}};if(field==='failure')return {status:'retryable-failure',failure:raceMatchFailure('temporarily-unavailable',1000)};return {status:'cancelled'};}};
window.currentProvider=window.provider;window.failResolver=false;window.newer=false;window.recoveryKey=RACE_RECOVERY_KEY;
const now=Date.now(),record={version:1,id:'saved-search',ownerId:'owner-1',locale:'en',savedAtMs:now,expiresAtMs:now+RACE_RECOVERY_TTL_MS,intent:{kind:'search',request:{locale:'en',requestId:'old-receipt'}}};
if(field==='saved-failure')record.intent.failure=raceMatchFailure('temporarily-unavailable',1000);localStorage.setItem(RACE_RECOVERY_KEY,JSON.stringify(record));
window.lookup=()=>{if(window.newer){window.newer=false;localStorage.setItem(RACE_RECOVERY_KEY,JSON.stringify({...record,id:'newer-search'}));}if(window.failResolver)throw new Error('lookup');return window.currentProvider;};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')window.releaseCatalog=()=>authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={window.provider} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;').replace('getMatchmaking: () => optionsRef.current.getMatchmaking?.(),','getMatchmaking: () => globalThis.lookup(),'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['cancelled','failure','empty','saved-failure','retired']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.releaseCatalog&&!window.testRaceSession.getSnapshot().findingOpponent);
 const before=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {error:s.error,status:s.matchSearchStatus,failure:s.matchFailure};});
 assert.equal(before.status,['cancelled','retired'].includes(field)?'idle':field==='empty'?'empty':'failed');
 assert.equal(await page.evaluate(()=>window.calls.length),field==='saved-failure'?0:1);
 await page.evaluate(async()=>window.releaseCatalog());
 await page.waitForFunction(()=>window.testRaceSession.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 const after=await page.evaluate(()=>{const s=window.testRaceSession.getSnapshot();return {error:s.error,status:s.matchSearchStatus,failure:s.matchFailure};});
 assert.deepEqual(after,before);
 assert(await page.getByRole('button',{name:/Mixed|General/i}).count()>0);
 if(!['cancelled','retired'].includes(field))assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(window.recoveryKey)).intent.request.requestId),'old-receipt');
 assert.deepEqual(errors,[]);console.log('Cold search catalog passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
