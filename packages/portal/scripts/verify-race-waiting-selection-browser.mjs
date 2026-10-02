import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-waiting-selection-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
const mode=new URLSearchParams(location.search).get('case');window.commands=[];window.testNow=0;Object.defineProperty(performance,'now',{value:()=>window.testNow});
window.waiting=()=>({status:'waiting',serverNowMs:10000,invitation:{claimState:'unclaimed',publicationState:'pending',role:mode==='creator'?'creator':'recipient',canCancel:mode==='creator',expiresAtMs:mode==='expiry'||mode==='revive'?11000:1000000}});
window.reply=(message,operation,data)=>window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));
function postToHost(message){window.commands.push(message);if(message.type==='game:getRaceEntry'&&window.commands.filter(m=>m.type==='game:getRaceEntry').length===1)window.reply(message,'raceEntry',window.waiting());}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" challengeId="original" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-waiting-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('new RaceSession(entry, {','new RaceSession(entry, {random:()=>0.5,').replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['identity','clear','expiry','capability','creator','retry','revive','control']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+mode);
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().entryStatus?.status==='waiting'&&!window.testRaceSession.getSnapshot().pending);
  await page.evaluate(mode=>{
   const session=window.testRaceSession,state=session.getSnapshot();
   if(mode==='identity'||mode==='retry')state.activeChallengeId='foreign';
   if(mode==='clear'||mode==='creator')state.entryStatus=null;
   if(mode==='creator')state.activeChallengeId='foreign';
   if(mode==='expiry')state.entryStatus.invitation.expiresAtMs=1000000;
   if(mode==='capability'){state.entryStatus.invitation.canCancel=true;state.entryStatus.invitation.role='creator';}
   if(mode==='revive'){session.setVisible(false);session.setVisible(true);window.testNow=1000;session.tick();state.entryStatus=window.waiting();session.getSnapshot().entryStatus=window.waiting();window.reply(window.commands.at(-1),'raceEntry',{...window.waiting(),invitation:{...window.waiting().invitation,expiresAtMs:1000000}});}
   else if(mode==='retry')session.retry();
   else if(mode==='capability')session.cancelInvitation();
   else if(mode!=='creator'){window.testNow=1000;session.tick();}
   if(mode==='creator'||mode==='capability')session.reportError(null);
  },mode);
  if(mode==='creator')await page.locator('.race-challenge-card .race-secondary').click();
  const actual=await page.evaluate(()=>{const state=window.testRaceSession.getSnapshot();return {status:state.entryStatus?.status,reads:window.commands.filter(m=>m.type==='game:getRaceEntry').map(m=>m.payload.challengeId),cancels:window.commands.filter(m=>m.type==='game:cancelRaceInvite').map(m=>m.payload.challengeId)};});
  if(mode==='expiry'||mode==='revive')assert.equal(actual.status,'expired');
  if(['identity','clear','retry','control'].includes(mode))assert.deepEqual(actual.reads,['original','original']);
  if(mode==='creator')assert.deepEqual(actual.cancels,['original']);else assert.deepEqual(actual.cancels,[]);
  if(mode==='capability')assert.equal(await page.locator('.race-challenge-card .race-secondary').count(),0);
  assert.deepEqual(errors,[]);console.log('Waiting selection passed: '+mode+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
