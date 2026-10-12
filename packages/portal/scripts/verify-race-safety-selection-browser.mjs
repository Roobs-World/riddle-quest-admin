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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-safety-selection-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const field=new URLSearchParams(location.search).get('case');
const item=id=>({itemId:id,challengeId:'challenge',opponentUserId:id,opponentDisplayName:id,categoryId:'history',result:'win',adjustedDeltaMs:1000,read:false,createdAtMs:0});
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:listRaceInbox')reply(message,'raceInbox',{items:[item('selected'),item('other')]});
 if(message.type==='game:blockRival'||message.type==='game:reportRival'){
  const state=window.testRaceSession.getSnapshot();
  if(field.includes('clear'))state.safetyTargetUserId=null;
  if(field.includes('replace'))state.safetyTargetUserId='other';
  reply(message,message.type==='game:blockRival'?'raceBlock':'raceReport',message.type==='game:blockRival'?{blocked:true}:{queued:true});
 }
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" openInbox coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['block-dispatch','report-dispatch','block-replace','block-clear','report-clear','block-valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().inboxItems.length===2&&!window.testRaceSession.getSnapshot().pending);
 if(field.includes('dispatch'))await page.evaluate(()=>{const session=window.testRaceSession,item=session.getSnapshot().inboxItems[0];window.unsubscribe=session.subscribe(()=>{if(session.getSnapshot().safetyTargetUserId==='selected')item.opponentUserId='other';});});
 await page.locator('.race-safety-actions summary').first().click();
 await page.getByRole('button',{name:field.startsWith('block')?/^Block/:/^Report/}).first().click();
 await page.waitForFunction(()=>window.commands.some(m=>m.type==='game:blockRival'||m.type==='game:reportRival')&&!window.testRaceSession.getSnapshot().pending);
 const actual=await page.evaluate(()=>{window.unsubscribe?.();const state=window.testRaceSession.getSnapshot(),command=window.commands.find(m=>m.type==='game:blockRival'||m.type==='game:reportRival');return {payload:command.payload,error:state.error,target:state.safetyTargetUserId,notice:state.safetyNotice,items:state.inboxItems.map(i=>i.opponentUserId)};});
 assert.equal(actual.payload.targetUserId,'selected');assert.equal(actual.error,null);assert.equal(actual.target,null);
 assert.equal(actual.notice,field.startsWith('block')?'RaceTo10.BLOCK_SUCCESS':'RaceTo10.REPORT_SUCCESS');
 if(!field.includes('dispatch'))assert.deepEqual(actual.items,field.startsWith('block')?['other']:['selected','other']);
 assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
 console.log('Safety selection passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
